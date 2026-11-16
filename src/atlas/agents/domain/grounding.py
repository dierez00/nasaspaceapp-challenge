"""Grounding of the UI against what the tools logged.

The composer LLM rewrites tables and citations into the UIPayload; Pydantic only
checks the shape. This step makes sure every value the user sees as data comes
from the tools, not from the LLM:

- table:     columns must equal those of a logged query and every row must be one
             of that query's rows. Otherwise the logged table replaces it.
- citations: experiment_id and source_file must match a logged fragment and the
             quote must be literal text of it. section is copied from the fragment.
             Items that do not match are dropped.
- gap_map:   experiment_ids must appear in the logged rows or fragments. If none
             is left, the experiments of the logged table are used instead.
- brief:     evidence is a recorded table (replaced otherwise); the gap bounds are computed
             in Python from the filters, never taken from the LLM; next-step figures must
             be in the data or the gap; verdict and each audience lens are replaced by the
             rules text when they hold figures that are not in the data.
- free text: summary, text, notice, table titles and the gap_map note may only
             contain figures that appear in the data (cells, totals, correlation,
             fragment text) or in the question, PSI ids that appear in the data and
             [n] refs of logged fragments. Otherwise the text is replaced or dropped.
"""

import math
import re
from typing import Any

from atlas.agents.domain import brief as brief_rules
from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION
from atlas.agents.domain.labels import humanize_ui
from atlas.agents.domain.lang import DEFAULT_LANG, Lang
from atlas.agents.domain.ui import (
    BriefComponent,
    BriefEvidence,
    BriefGap,
    BriefStep,
    Citation,
    CitationsComponent,
    GapMapComponent,
    NoticeComponent,
    TableComponent,
    TextComponent,
    UIPayload,
)

AgentResult = dict[str, Any] | None
MAX_COMPONENTS = 7

NO_GAP_IDS_NOTE = "Sin experimentos concretos para resaltar."
FALLBACK_TABLE_TITLE = "Ensayos consultados"
_NO_GAP_IDS_NOTES: dict[Lang, str] = {"es": NO_GAP_IDS_NOTE, "en": "No specific experiments to highlight."}
_FALLBACK_TABLE_TITLES: dict[Lang, str] = {"es": FALLBACK_TABLE_TITLE, "en": "Trials queried"}

_PSI_ID = re.compile(r"\bPSI-(\d+)\b")
_REF = re.compile(r"\[(\d+)\]")
# A figure never starts inside a word or a number: the 2 of "O2", "CO2" or "o2_basis" is not one.
_NUMBER = re.compile(r"(?<!\w)(?<![0-9][.,])[0-9]+(?:[.,][0-9]+)*")


class Evidence:
    """Everything the tools logged for one question: what text may quote."""

    def __init__(
        self, question: str, analyst: AgentResult, researcher: AgentResult, lang: Lang = DEFAULT_LANG
    ) -> None:
        self.lang: Lang = lang
        self.queries = [q for q in (analyst or {}).get("consultas", []) if q.get("columns")]
        self.sources = [s for s in (researcher or {}).get("fuentes", []) if s.get("content")]
        self.refs = {s["ref"] for s in self.sources if isinstance(s.get("ref"), int)}
        self.ids = {s["experiment_id"] for s in self.sources}
        numbers: set[float] = set()
        for query in self.queries:
            self.ids.update(_ids_in(_cells(query)))
            for value in _cells(query):
                numbers.update(_numbers_in(value))
        for source in self.sources:
            numbers.update(_numbers_in(source["content"]))
        numbers.update(_numbers_in(question))
        self.question = question
        self.gap, self.gap_empty = brief_rules.compute_gap_ex(question, self.queries, lang)
        numbers.update(brief_rules.gap_numbers(self.gap))
        self.numbers = numbers
        self.words = {question.casefold()} | {c.casefold() for q in self.queries for c in _cells(q) if isinstance(c, str)}

    def knows_number(self, value: float | None) -> bool:
        return value is None or any(math.isclose(value, n, rel_tol=1e-9, abs_tol=1e-9) for n in self.numbers)

    def knows_word(self, word: str | None) -> bool:
        return not word or any(word.casefold() in w for w in self.words)

    def table_ids(self) -> list[str]:
        """Experiments of the last logged table, as the rules composer highlights them."""
        for query in reversed(self.queries):
            if "experiment_id" in query["columns"] and query.get("rows"):
                index = query["columns"].index("experiment_id")
                return sorted({r[index] for r in query["rows"] if isinstance(r[index], str) and r[index] in self.ids})
        return []

    def text_is_grounded(self, text: str | None) -> bool:
        if not text:
            return True
        for match in _PSI_ID.finditer(text):
            if match.group(0) not in self.ids:
                return False
        for match in _REF.finditer(text):
            if int(match.group(1)) not in self.refs:
                return False
        rest = _REF.sub(" ", _PSI_ID.sub(" ", text))
        return all(_is_known(token, self.numbers) for token in _NUMBER.findall(rest))


def ground_ui(
    ui: UIPayload,
    evidence: Evidence,
    fallback_summary: str,
    fallback_brief: BriefComponent | None = None,
) -> tuple[UIPayload | None, list[str]]:
    """Returns the grounded UI (None if nothing but notices is left) and what was corrected."""
    components: list[Any] = []
    fixes: list[str] = []
    for component in ui.components:
        grounded = _ground_component(component, evidence)
        if grounded != component:
            fixes.append(f"{component.type} corregido" if grounded else f"{component.type} descartado")
        if grounded is not None:
            components.append(grounded)

    summary = ui.summary
    if not evidence.text_is_grounded(summary):
        summary = fallback_summary
        fixes.append("summary reemplazado")

    briefs = [c for c in components if isinstance(c, BriefComponent)]
    if briefs and brief_rules.near_duplicate(summary, briefs[0].verdict) and not brief_rules.near_duplicate(
        fallback_summary, briefs[0].verdict
    ):
        summary = fallback_summary
        fixes.append("summary diferenciado del veredicto")
    if len(briefs) > 1:
        components = [c for c in components if not isinstance(c, BriefComponent)]
        components.insert(0, briefs[0])
        fixes.append("brief duplicado descartado")
    if not briefs and fallback_brief is not None and any(c.type != "notice" for c in components):
        components.insert(0, fallback_brief)
        fixes.append("brief añadido")

    if not any(c.type != "notice" for c in components):
        return None, fixes
    return humanize_ui(UIPayload(summary=summary, components=components), evidence.lang), fixes


def _ground_component(component: Any, evidence: Evidence) -> Any:
    if isinstance(component, TableComponent):
        return _ground_table(component, evidence)
    if isinstance(component, CitationsComponent):
        return _ground_citations(component, evidence.sources)
    if isinstance(component, GapMapComponent):
        return _ground_gap_map(component, evidence)
    if isinstance(component, BriefComponent):
        return _ground_brief(component, evidence)
    if isinstance(component, (TextComponent, NoticeComponent)):
        text = component.body if isinstance(component, TextComponent) else component.message
        return component if evidence.text_is_grounded(text) else None
    return component


def _ground_brief(brief: BriefComponent, evidence: Evidence) -> BriefComponent:
    queries = evidence.queries
    totals = [q["total"] for q in queries if isinstance(q.get("total"), int)]
    gap = _ground_brief_gap(brief.gap, evidence)
    verdict = brief.verdict
    if not evidence.text_is_grounded(verdict):
        verdict = brief_rules.default_verdict(
            DEFAULT_CLASSIFICATION, queries, bool(evidence.sources), evidence.gap_empty, evidence.lang
        )
    defaults = brief_rules.default_lenses(gap, totals[-1] if totals else None, evidence.lang)
    lenses = brief.lenses.model_copy(
        update={
            name: text if evidence.text_is_grounded(text) else getattr(defaults, name)
            for name, text in brief.lenses.model_dump().items()
        }
    )
    steps = [_ground_step(step, gap, evidence) for step in brief.next_steps[: brief_rules.MAX_STEPS]]
    return brief.model_copy(
        update={
            "verdict": verdict,
            "evidence": _ground_brief_evidence(brief.evidence, evidence),
            "gap": gap,
            "next_steps": steps,
            "lenses": lenses,
        }
    )


def _ground_brief_evidence(table: BriefEvidence | None, evidence: Evidence) -> BriefEvidence | None:
    if table is None:
        return None
    as_table = _ground_table(
        TableComponent(type="table", title=table.title, columns=table.columns, rows=table.rows), evidence
    )
    if as_table is None:
        return None
    ids = [i for i in table.experiment_ids if i in evidence.ids]
    if as_table.rows != table.rows or as_table.columns != table.columns or not ids:
        ids = brief_rules.experiment_ids(as_table.columns, as_table.rows)
    return BriefEvidence(title=as_table.title, columns=as_table.columns, rows=as_table.rows, experiment_ids=ids)


def _ground_brief_gap(gap: BriefGap | None, evidence: Evidence) -> BriefGap | None:
    """Bounds and gravity come from the computed gap; the LLM only may word the description."""
    computed = evidence.gap
    if computed is None or gap is None:
        return computed
    if evidence.text_is_grounded(gap.description) and not brief_rules.conflicts_with_gravity(
        gap.description, computed.gravity
    ):
        return computed.model_copy(update={"description": gap.description})
    return computed


def _ground_step(step: BriefStep, gap: BriefGap | None, evidence: Evidence) -> BriefStep:
    base = brief_rules.default_step(step.kind, gap, evidence.lang)
    label = step.label if evidence.text_is_grounded(step.label) else base.label
    figures = {
        "pressure_kpa": step.pressure_kpa if evidence.knows_number(step.pressure_kpa) else None,
        "o2_percent": step.o2_percent if evidence.knows_number(step.o2_percent) else None,
    }
    material = step.material if evidence.knows_word(step.material) else None
    return step.model_copy(update={"label": label, "material": material, **figures})


def _ground_table(table: TableComponent, evidence: Evidence) -> TableComponent | None:
    if not evidence.text_is_grounded(table.title):
        table = table.model_copy(update={"title": _FALLBACK_TABLE_TITLES[evidence.lang]})
    same_columns = [q for q in evidence.queries if q["columns"] == table.columns]
    for query in same_columns:
        logged = [list(row) for row in query.get("rows", [])]
        if all(list(row) in logged for row in table.rows):
            return table
    candidates = [q for q in (same_columns or evidence.queries) if q.get("rows")]
    if not candidates:
        return None
    logged = candidates[-1]
    return table.model_copy(update={"columns": logged["columns"], "rows": logged["rows"]})


def _ground_citations(component: CitationsComponent, sources: list[dict[str, Any]]) -> CitationsComponent | None:
    items = []
    for item in component.items:
        source = _source_for(item, sources)
        if source is not None:
            items.append(item.model_copy(update={"section": source.get("section")}))
    if not items:
        return None
    if items == list(component.items):
        return component
    return component.model_copy(update={"items": items})


def _ground_gap_map(gap_map: GapMapComponent, evidence: Evidence) -> GapMapComponent:
    ids = [i for i in gap_map.experiment_ids if i in evidence.ids]
    note = gap_map.note if evidence.text_is_grounded(gap_map.note) else None
    if not ids and gap_map.experiment_ids:
        ids = evidence.table_ids()
    if not ids:
        note = note or _NO_GAP_IDS_NOTES[evidence.lang]
    if ids == gap_map.experiment_ids and note == gap_map.note:
        return gap_map
    return gap_map.model_copy(update={"experiment_ids": ids, "note": note})


def _source_for(item: Citation, sources: list[dict[str, Any]]) -> dict[str, Any] | None:
    quote = _squash(item.quote)
    for source in sources:
        if (
            source["experiment_id"] == item.experiment_id
            and source["source_file"] == item.source_file
            and quote in _squash(source["content"])
        ):
            return source
    return None


def _cells(query: dict[str, Any]) -> list[Any]:
    cells: list[Any] = [query.get("total")]
    for row in query.get("rows", []):
        cells.extend(row)
    correlation = query.get("correlacion") or {}
    cells.extend(v for k, v in correlation.items() if k in ("n", "pearson"))
    return cells


def _ids_in(cells: list[Any]) -> set[str]:
    """PSI ids in string cells, also inside a grouped `experimentos` list ("PSI-1, PSI-2")."""
    return {match.group(0) for c in cells if isinstance(c, str) for match in _PSI_ID.finditer(c)}


def _numbers_in(value: Any) -> set[float]:
    if isinstance(value, bool) or value is None:
        return set()
    if isinstance(value, (int, float)):
        return {float(value)} if math.isfinite(value) else set()
    found: set[float] = set()
    for token in _NUMBER.findall(_PSI_ID.sub(" ", str(value))):
        found.update(_readings(token))
    return found


def _readings(token: str) -> set[float]:
    """'1,283' may be 1283 or 1.283; '12,5' may be 12.5. Any reading counts."""
    readings = set()
    for candidate in (token.replace(",", ""), token.replace(".", "").replace(",", "."), token.replace(",", ".")):
        try:
            readings.add(float(candidate))
        except ValueError:
            continue
    return readings


def _is_known(token: str, numbers: set[float]) -> bool:
    return any(math.isclose(r, n, rel_tol=1e-9, abs_tol=1e-9) for r in _readings(token) for n in numbers)


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()
