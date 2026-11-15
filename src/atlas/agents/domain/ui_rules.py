"""Fixed-rule composer: query kind -> component. Used for COMPOSITOR_MODE=rules,
AGENTS_MOCK and as the fallback when the composer agent fails twice.

Agent results are plain dicts (they are also what the composer agent reads):
- analyst:    {"respuesta": str | None, "consultas": [{"filtros", "columns", "rows", "total", "truncated"}]}
- researcher: {"respuesta": str | None, "fuentes": [{"ref", "experiment_id", "source_file", "section", "content",
                                                      "score", "rerank_score"}]}  (best first)
- either one: {"error": str} when it failed or timed out, or None when it was not run.

The analyst's and researcher's free-text answers are written by an LLM, so they are
only included when grounding.Evidence finds every figure, PSI id and [n] ref in the data.
"""

from typing import Any

from atlas.agents.domain.classification import Classification
from atlas.agents.domain.grounding import AgentResult, Evidence
from atlas.agents.domain.ui import (
    Citation,
    CitationsComponent,
    GapMapComponent,
    NoticeComponent,
    TableComponent,
    TextComponent,
    UIPayload,
)

MAX_CITATIONS = 5
MAX_QUOTE = 600

_SUMMARIES = {
    "huecos": "Estas son las condiciones con datos en el Atlas; las zonas sin ensayos son los huecos.",
    "comparar": "Comparación de los ensayos registrados en el Atlas.",
    "evidencia": "Esto dicen los documentos de NASA PSI sobre la pregunta.",
    "general": "Esto es lo que el Atlas tiene sobre la pregunta.",
}
_NO_DATA = "No encontré datos ni fuentes para responder; prueba a reformular la pregunta."


def rules_summary(classification: Classification) -> str:
    return _SUMMARIES[classification.tipo]


def build_rules_ui(
    classification: Classification, analyst: AgentResult, researcher: AgentResult, question: str = ""
) -> UIPayload:
    """The agents' own answers are shown only if their figures and ids appear in the data."""
    evidence = Evidence(question, analyst, researcher)
    table = _last_table(analyst)
    citations = _citations(researcher)
    components: list[Any] = []

    if classification.tipo == "huecos":
        components.append(
            GapMapComponent(
                type="gap_map",
                title="Mapa de huecos",
                experiment_ids=_experiment_ids(table),
                gravity_environment=None,
                note=None,
            )
        )
    elif classification.tipo == "evidencia" and citations:
        components.append(citations)
        citations = None

    for answer in (_answer(analyst), _answer(researcher)):
        if answer and evidence.text_is_grounded(answer):
            components.append(TextComponent(type="text", body=answer))
    if table:
        components.append(table)
    o2_notice = _o2_basis_notice(analyst, table)
    if o2_notice:
        components.append(o2_notice)
    if citations:
        components.append(citations)
    for name, result in (("analista", analyst), ("investigador", researcher)):
        if result and result.get("error"):
            components.append(
                NoticeComponent(type="notice", level="warning", message=f"El {name} no respondió: {result['error']}")
            )

    if not any(c.type != "notice" for c in components):
        components.insert(0, TextComponent(type="text", body=_NO_DATA))
    return UIPayload(summary=_SUMMARIES[classification.tipo], components=components[:6])


def _o2_basis_notice(analyst: AgentResult, table: TableComponent | None) -> NoticeComponent | None:
    """Tells the user which kind of O2 the table holds when the analyst's query makes it matter."""
    queries = [q for q in (analyst or {}).get("consultas", []) if q.get("columns") and q.get("rows")]
    report = (queries[-1].get("o2_basis") or {}) if queries else {}
    if table is None or not isinstance(report, dict):
        return None
    mixed = report.get("advertencia") or (
        (report.get("ensayos") or {}).get("oxidizer_stream") and "o2_basis" not in table.columns
    )
    if mixed:
        message = (
            "Parte del O2 de estos datos es de la corriente de oxidante de un quemador (PSI-159), "
            "no de una atmósfera."
        )
    elif report.get("por_defecto"):
        message = "Los rangos de O2 y presión solo incluyen ensayos con atmósfera ambiente (o2_basis = ambient)."
    else:
        return None
    return NoticeComponent(type="notice", level="info", message=message)


def _answer(result: AgentResult) -> str | None:
    if not result:
        return None
    text = result.get("respuesta")
    return text.strip() if isinstance(text, str) and text.strip() else None


def _last_table(analyst: AgentResult) -> TableComponent | None:
    queries = [q for q in (analyst or {}).get("consultas", []) if q.get("columns") and q.get("rows")]
    if not queries:
        return None
    last = queries[-1]
    return TableComponent(type="table", title="Ensayos consultados", columns=last["columns"], rows=last["rows"])


def _experiment_ids(table: TableComponent | None) -> list[str]:
    if table is None or "experiment_id" not in table.columns:
        return []
    index = table.columns.index("experiment_id")
    ids = {row[index] for row in table.rows if isinstance(row[index], str) and row[index].startswith("PSI-")}
    return sorted(ids)


def _citations(researcher: AgentResult) -> CitationsComponent | None:
    sources = (researcher or {}).get("fuentes", [])[:MAX_CITATIONS]
    items = [
        Citation(
            experiment_id=s["experiment_id"],
            source_file=s["source_file"],
            section=s.get("section"),
            quote=s["content"].strip()[:MAX_QUOTE],
        )
        for s in sources
        if s.get("content", "").strip()
    ]
    return CitationsComponent(type="citations", items=items) if items else None
