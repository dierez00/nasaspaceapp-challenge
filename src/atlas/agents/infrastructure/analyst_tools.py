"""In-process MCP tool for the analyst: structured filters, metrics and correlation over
the experiments loaded in Python from Postgres (same repository as GET /experiments). No SQL."""

import json
from collections.abc import Awaitable, Callable
from typing import Any

from claude_agent_sdk import McpSdkServerConfig, create_sdk_mcp_server, tool
from pydantic import ValidationError

from atlas.agents.domain.ensayos import MAX_ROWS, FiltroEnsayos, consultar
from atlas.experiments.domain.experiment import Experiment

SERVER_NAME = "analista"
TOOL_NAME = "consultar_ensayos"
ALLOWED_TOOLS = [f"mcp__{SERVER_NAME}__{TOOL_NAME}"]

ExperimentLoader = Callable[[], Awaitable[list[Experiment]]]


def build_analyst_server(load: ExperimentLoader, log: list[dict[str, Any]]) -> McpSdkServerConfig:
    """Experiments are loaded once per analyst run. `log` collects every successful
    query so the composer and the rules UI can reuse the rows."""
    loaded: list[Experiment] | None = None

    @tool(
        TOOL_NAME,
        f"Filtra los ensayos de combustión del Atlas y devuelve hasta {MAX_ROWS} filas como JSON, "
        "o conteos por grupo si indicas agrupar_por; metricas da promedio, mínimo y máximo, y "
        "correlacion da Pearson entre dos campos. Todos los parámetros son opcionales. "
        "Los errores vuelven como texto para que corrijas los parámetros.",
        FiltroEnsayos.model_json_schema(),
    )
    async def consultar_ensayos(args: dict[str, Any]) -> dict[str, Any]:
        nonlocal loaded
        try:
            filtro = FiltroEnsayos.model_validate(args)
        except ValidationError as exc:
            return _error(f"Parámetros inválidos: {exc}"[:1500])
        if loaded is None:
            try:
                loaded = await load()
            except Exception as exc:  # noqa: BLE001 - any failure goes back to the agent as text
                return _error(f"No se pudieron cargar los experimentos de Postgres: {type(exc).__name__}")
            if not loaded:
                loaded = None
                return _error("Postgres no tiene experimentos cargados (falta ejecutar atlas-load).")
        result = consultar(loaded, filtro)
        log.append({"filtros": filtro.model_dump(mode="json", exclude_defaults=True), **result})
        return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]}

    return create_sdk_mcp_server(name=SERVER_NAME, tools=[consultar_ensayos])


def _error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "is_error": True}
