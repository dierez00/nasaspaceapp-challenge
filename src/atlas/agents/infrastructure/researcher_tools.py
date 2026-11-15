"""In-process MCP tool for the researcher: role 2's search_documents (vector
search + optional Voyage reranker) over PSI document chunks."""

import json
from collections.abc import Awaitable, Callable
from typing import Any

from claude_agent_sdk import McpSdkServerConfig, create_sdk_mcp_server, tool

SERVER_NAME = "investigador"
TOOL_NAME = "buscar_documentos"
ALLOWED_TOOLS = [f"mcp__{SERVER_NAME}__{TOOL_NAME}"]
MAX_K = 8
EXCERPT_CHARS = 1200

# Returns hits as dicts: experiment_id, source_file, section, content, score, rerank_score.
SearchFn = Callable[[str, int], Awaitable[list[dict[str, Any]]]]

_INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "consulta": {"type": "string", "description": "Qué buscar, idealmente en inglés como los informes"},
        "k": {"type": "integer", "minimum": 1, "maximum": MAX_K, "description": "Número de fragmentos"},
    },
    "required": ["consulta"],
}


def add_refs(log: list[dict[str, Any]], hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Give each hit a stable citation number `ref` (1, 2, ...) across the whole run.
    A fragment found twice keeps its first number; new ones are appended to `log`."""
    known = {_key(hit): hit["ref"] for hit in log}
    numbered = []
    for hit in hits:
        ref = known.get(_key(hit))
        if ref is None:
            ref = len(log) + 1
            known[_key(hit)] = ref
            log.append({"ref": ref, **hit})
        numbered.append({"ref": ref, **hit})
    return numbered


def _key(hit: dict[str, Any]) -> tuple[str, str, str]:
    return (hit["experiment_id"], hit["source_file"], hit["content"])


def build_researcher_server(search: SearchFn, log: list[dict[str, Any]]) -> McpSdkServerConfig:
    """`log` collects every fragment returned, numbered by `ref`, for citations."""

    @tool(
        TOOL_NAME,
        "Busca fragmentos de los documentos de NASA PSI (similitud vectorial reordenada por un reranker). "
        "Devuelve ref, experimento, archivo, sección, texto, score y rerank_score de cada fragmento; "
        "cítalos por su ref.",
        _INPUT_SCHEMA,
    )
    async def buscar_documentos(args: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("consulta", "")).strip()
        if not query:
            return {"content": [{"type": "text", "text": "La consulta está vacía."}], "is_error": True}
        k = max(1, min(int(args.get("k") or 5), MAX_K))
        try:
            hits = await search(query, k)
        except Exception as exc:  # noqa: BLE001 - any failure goes back to the agent as text
            return {"content": [{"type": "text", "text": f"La búsqueda falló: {exc}"}], "is_error": True}
        numbered = add_refs(log, hits)
        excerpts = [{**hit, "content": hit["content"][:EXCERPT_CHARS]} for hit in numbered]
        return {"content": [{"type": "text", "text": json.dumps(excerpts, ensure_ascii=False, default=str)}]}

    return create_sdk_mcp_server(name=SERVER_NAME, tools=[buscar_documentos])
