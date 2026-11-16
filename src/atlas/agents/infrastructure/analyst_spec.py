"""Provider-neutral tool for the analyst: structured filters, metrics and correlation over
the experiments loaded in Python from Postgres (same repository as GET /experiments). No SQL."""

import json
from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import ValidationError

from atlas.agents.domain.ensayos import MAX_ROWS, FiltroEnsayos, consultar
from atlas.agents.infrastructure.tool_spec import ToolResult, ToolSpec
from atlas.experiments.domain.experiment import Experiment

TOOL_NAME = "consultar_ensayos"

ExperimentLoader = Callable[[], Awaitable[list[Experiment]]]


def build_analyst_spec(load: ExperimentLoader, log: list[dict[str, Any]]) -> ToolSpec:
    """Experiments are loaded once per analyst run. `log` collects every successful
    query so the composer and the rules UI can reuse the rows."""
    loaded: list[Experiment] | None = None

    async def consultar_ensayos(args: dict[str, Any]) -> ToolResult:
        nonlocal loaded
        try:
            filtro = FiltroEnsayos.model_validate(args)
        except ValidationError as exc:
            return ToolResult(f"Parámetros inválidos: {exc}"[:1500], is_error=True)
        if loaded is None:
            try:
                loaded = await load()
            except Exception as exc:  # noqa: BLE001 - any failure goes back to the agent as text
                return ToolResult(
                    f"No se pudieron cargar los experimentos de Postgres: {type(exc).__name__}", is_error=True
                )
            if not loaded:
                loaded = None
                return ToolResult("Postgres no tiene experimentos cargados (falta ejecutar atlas-load).", is_error=True)
        result = consultar(loaded, filtro)
        log.append({"filtros": filtro.model_dump(mode="json", exclude_defaults=True), **result})
        return ToolResult(json.dumps(result, ensure_ascii=False))

    return ToolSpec(
        TOOL_NAME,
        f"Filtra los ensayos de combustión del Atlas y devuelve hasta {MAX_ROWS} filas como JSON, "
        "o conteos por grupo si indicas agrupar_por; metricas da promedio, mínimo y máximo, y "
        "correlacion da Pearson entre dos campos. Todos los parámetros son opcionales. "
        "o2_basis distingue O2 de atmósfera (ambient) de O2 de corriente de quemador (oxidizer_stream); "
        "los rangos de O2 o presión solo miran ambient salvo que indiques o2_basis. "
        "Los errores vuelven como texto para que corrijas los parámetros.",
        FiltroEnsayos.model_json_schema(),
        consultar_ensayos,
    )
