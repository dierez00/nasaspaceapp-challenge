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
from atlas.agents.domain.brief import EVIDENCE_TITLES, build_rules_brief
from atlas.agents.domain.labels import humanize_ui
from atlas.agents.domain.lang import DEFAULT_LANG, Lang
from atlas.agents.domain.grounding import MAX_COMPONENTS, AgentResult, Evidence
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

_SUMMARIES: dict[Lang, dict[str, str]] = {
    "es": {
        "huecos": "Las zonas del mapa sin ensayos son los huecos: ahí está lo que aún no sabemos.",
        "comparar": "Las diferencias entre los ensayos del Atlas se ven en la tabla.",
        "evidencia": "Los informes de NASA PSI explican este fenómeno; las citas muestran en qué se basan.",
        "general": "El Atlas reúne ensayos e informes sobre esta pregunta; esto es lo que muestran.",
    },
    "en": {
        "huecos": "The map areas without trials are the gaps: that is what we do not know yet.",
        "comparar": "The table shows how the Atlas trials differ.",
        "evidencia": "NASA PSI reports explain this phenomenon; the citations show what they rely on.",
        "general": "The Atlas gathers trials and reports on this question; this is what they show.",
    },
}
_NO_DATA: dict[Lang, str] = {
    "es": "No hay ensayos ni informes del Atlas que respondan a esta pregunta; prueba con otras condiciones.",
    "en": "No Atlas trials or reports answer this question; try other conditions.",
}
# Notices speak about the data, never about who failed or why.
_UNAVAILABLE: dict[Lang, dict[str, str]] = {
    "es": {
        "analista": "No se pudieron consultar los ensayos del Atlas en este momento.",
        "investigador": "No se pudieron consultar los informes de NASA PSI en este momento.",
    },
    "en": {
        "analista": "The Atlas trials could not be queried right now.",
        "investigador": "The NASA PSI reports could not be queried right now.",
    },
}
_GAP_MAP_TITLE: dict[Lang, str] = {"es": "Mapa de huecos", "en": "Gap map"}
_O2_NOTICES: dict[Lang, dict[str, str]] = {
    "es": {
        "mixed": "Parte del O2 de estos datos es de la corriente de oxidante de un quemador (PSI-159), no de una atmósfera.",
        "default": (
            "Los rangos de O₂ y presión solo incluyen ensayos con atmósfera ambiental, "
            "no la corriente de oxidante de un quemador."
        ),
    },
    "en": {
        "mixed": "Part of the O2 in this data comes from a burner's oxidizer stream (PSI-159), not from an atmosphere.",
        "default": (
            "The O₂ and pressure ranges only include trials in an ambient atmosphere, "
            "not a burner's oxidizer stream."
        ),
    },
}


def rules_summary(classification: Classification, lang: Lang = DEFAULT_LANG) -> str:
    return _SUMMARIES[lang][classification.tipo]


def build_rules_ui(
    classification: Classification,
    analyst: AgentResult,
    researcher: AgentResult,
    question: str = "",
    lang: Lang = DEFAULT_LANG,
) -> UIPayload:
    """The agents' own answers are shown only if their figures and ids appear in the data."""
    evidence = Evidence(question, analyst, researcher, lang)
    table = _last_table(analyst, lang)
    citations = _citations(researcher)
    has_sources = citations is not None
    components: list[Any] = [
        build_rules_brief(classification, (analyst or {}).get("consultas", []), has_sources, question, lang)
    ]

    if classification.tipo == "huecos":
        components.append(
            GapMapComponent(
                type="gap_map",
                title=_GAP_MAP_TITLE[lang],
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
    o2_notice = _o2_basis_notice(analyst, table, lang)
    if o2_notice:
        components.append(o2_notice)
    if citations:
        components.append(citations)
    for name, result in (("analista", analyst), ("investigador", researcher)):
        if result and result.get("error"):
            components.append(NoticeComponent(type="notice", level="warning", message=_UNAVAILABLE[lang][name]))

    if table is None and not has_sources and all(c.type in ("brief", "notice") for c in components):
        components.insert(1, TextComponent(type="text", body=_NO_DATA[lang]))
    ui = UIPayload(summary=_SUMMARIES[lang][classification.tipo], components=components[:MAX_COMPONENTS])
    return humanize_ui(ui, lang)


def _o2_basis_notice(
    analyst: AgentResult, table: TableComponent | None, lang: Lang = DEFAULT_LANG
) -> NoticeComponent | None:
    """Tells the user which kind of O2 the table holds when the analyst's query makes it matter."""
    queries = [q for q in (analyst or {}).get("consultas", []) if q.get("columns") and q.get("rows")]
    report = (queries[-1].get("o2_basis") or {}) if queries else {}
    if table is None or not isinstance(report, dict):
        return None
    mixed = report.get("advertencia") or (
        (report.get("ensayos") or {}).get("oxidizer_stream") and "o2_basis" not in table.columns
    )
    if mixed:
        message = _O2_NOTICES[lang]["mixed"]
    elif report.get("por_defecto"):
        message = _O2_NOTICES[lang]["default"]
    else:
        return None
    return NoticeComponent(type="notice", level="info", message=message)


def _answer(result: AgentResult) -> str | None:
    if not result:
        return None
    text = result.get("respuesta")
    return text.strip() if isinstance(text, str) and text.strip() else None


def _last_table(analyst: AgentResult, lang: Lang = DEFAULT_LANG) -> TableComponent | None:
    queries = [q for q in (analyst or {}).get("consultas", []) if q.get("columns") and q.get("rows")]
    if not queries:
        return None
    last = queries[-1]
    return TableComponent(type="table", title=EVIDENCE_TITLES[lang], columns=last["columns"], rows=last["rows"])


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
