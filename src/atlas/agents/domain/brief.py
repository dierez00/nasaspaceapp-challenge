"""Evidence brief built in Python: gap bounds, verdict, next steps and audience lenses.

Everything numeric in a brief is computed here from the question or from what the analyst
recorded, never by the LLM. The rules composer uses these builders directly; grounding uses
them to replace what the composer wrote when it is not backed by the data.
"""

import re
from typing import Any

from atlas.agents.domain.classification import Classification
from atlas.agents.domain.ui import (
    BriefComponent,
    BriefEvidence,
    BriefGap,
    BriefLenses,
    BriefStep,
)

MAX_STEPS = 3
EVIDENCE_TITLE = "Ensayos consultados"
BRIEF_GRAVITIES = ("microgravity", "lunar", "martian", "normal")
_GRAVITY_LABEL = {
    "microgravity": "microgravedad",
    "lunar": "gravedad lunar",
    "martian": "gravedad marciana",
    "normal": "gravedad normal",
}
_GRAVITY_WORDS = (
    ("microgravity", ("microgravedad", "microgravity")),
    ("lunar", ("lunar", "luna")),
    ("martian", ("marciana", "marte", "martian")),
)
_MIN_WORDS = r"(?:m[aá]s de|mayor(?:es)? (?:a|que|de)|por encima de|al menos|>=|≥|>)"
_MAX_WORDS = r"(?:menos de|menor(?:es)? (?:a|que|de)|por debajo de|como m[aá]ximo|<=|≤|<)"
_NUMBER = r"(\d+(?:[.,]\d+)?)"
_O2_MIN = re.compile(rf"{_MIN_WORDS}\s*{_NUMBER}\s*%")
_O2_MAX = re.compile(rf"{_MAX_WORDS}\s*{_NUMBER}\s*%")
_PRESSURE_MIN = re.compile(rf"{_MIN_WORDS}\s*{_NUMBER}\s*kpa", re.IGNORECASE)
_PRESSURE_MAX = re.compile(rf"{_MAX_WORDS}\s*{_NUMBER}\s*kpa", re.IGNORECASE)
_O2_TOPIC = re.compile(r"o2|o₂|ox[ií]geno|oxygen", re.IGNORECASE)


def compute_gap(question: str, queries: list[dict[str, Any]]) -> BriefGap | None:
    return compute_gap_ex(question, queries)[0]


def compute_gap_ex(question: str, queries: list[dict[str, Any]]) -> tuple[BriefGap | None, bool]:
    """Returns the gap and whether it comes from a query that found no tests.

    Gap region from the recorded query filters (or the question), with a plain description.

    A gap exists when a recorded query with filters found no tests (the latest one wins), or
    when the grouped rows of the last query show a lunar or martian regime with no tests.
    """
    filtered = [q for q in queries if isinstance(q.get("filtros"), dict)]
    for query in reversed(filtered):
        bounds, gravity = _region(question, query)
        if query.get("total") == 0 and (any(v is not None for v in bounds.values()) or gravity):
            condition = _describe_condition(bounds)
            where = f" en {_GRAVITY_LABEL[gravity]}" if gravity else ""
            what = f" con {condition}" if condition else " con esas condiciones"
            return BriefGap(description=f"No hay ensayos registrados{what}{where}.", gravity=gravity, **bounds), True

    last = filtered[-1] if filtered else None
    missing = _missing_gravity(last)
    if last is None or missing is None:
        return None, False
    bounds, _ = _region(question, last)
    condition = _describe_condition(bounds)
    what = f" con {condition}" if condition else " con estas condiciones"
    return BriefGap(description=f"No hay ensayos en {_GRAVITY_LABEL[missing]}{what}.", gravity=missing, **bounds), False


def _region(question: str, query: dict[str, Any]) -> tuple[dict[str, float | None], str | None]:
    filters = query.get("filtros") or {}
    bounds = {
        "o2_percent_min": _num(filters.get("o2_min")),
        "o2_percent_max": _num(filters.get("o2_max")),
        "pressure_kpa_min": _num(filters.get("presion_min_kpa")),
        "pressure_kpa_max": _num(filters.get("presion_max_kpa")),
    }
    if all(v is None for v in bounds.values()):
        bounds = _bounds_from_question(question)
    return bounds, _single_gravity(filters.get("gravity_environment")) or _gravity_from_question(question)


def gap_numbers(gap: BriefGap | None) -> list[float]:
    if gap is None:
        return []
    values = (gap.pressure_kpa_min, gap.pressure_kpa_max, gap.o2_percent_min, gap.o2_percent_max)
    return [v for v in values if v is not None]


def default_verdict(
    classification: Classification, queries: list[dict[str, Any]], has_sources: bool, empty_region: bool = False
) -> str:
    if empty_region:
        return "El Atlas no tiene ensayos con esas condiciones."
    with_rows = [q for q in queries if q.get("total") is not None]
    if with_rows:
        last = with_rows[-1]
        total = last["total"]
        if total == 0:
            return "El Atlas no tiene ensayos con esas condiciones."
        finding = _finding(last)
        if classification.tipo == "huecos":
            return f"{finding}; lo que queda fuera de estas condiciones es el hueco."
        return f"{finding}."
    if has_sources:
        return "Los informes de NASA PSI explican este tema y los fragmentos citados lo respaldan."
    return "El Atlas no tiene datos ni documentos que respondan a esta pregunta."


def _finding(query: dict[str, Any]) -> str:
    """Professor-style finding with figures that are recorded cells or the recorded total."""
    filters = query.get("filtros") or {}
    material = filters.get("material") if isinstance(filters.get("material"), str) else None
    subject = f"Para {material} hay" if material else "En el Atlas hay"
    columns = query.get("columns") or []
    rows = query.get("rows") or []
    total = query["total"]

    if "ensayos" in columns and "gravity_environment" in columns and 0 < len(rows) <= 3:
        gi, ci = columns.index("gravity_environment"), columns.index("ensayos")
        parts = [
            (f"{r[ci]} {'ensayo' if r[ci] == 1 else 'ensayos'} en " if i == 0 else f"{r[ci]} en ")
            + _GRAVITY_LABEL.get(r[gi], str(r[gi]))
            for i, r in enumerate(rows)
            if isinstance(r[ci], int) and isinstance(r[gi], str)
        ]
        if parts:
            return f"{subject} {_join(parts)}"

    if "ensayos" in columns and rows:
        count = rows[0][columns.index("ensayos")]
        if len(rows) == 1 and isinstance(count, int):
            return f"{subject} {count} {'ensayo' if count == 1 else 'ensayos'}"
        return f"{subject} ensayos en {total} grupos de los datos"

    complete = not query.get("truncated") and len(rows) == total and "ensayos" not in columns
    noun = "ensayo" if total == 1 else "ensayos"
    text = f"{subject} {total} {noun}"
    if not complete or not rows:
        return text
    regimes = _column_values(columns, rows, "gravity_environment")
    if regimes and all(isinstance(v, str) for v in regimes):
        text += " en " + _join([_GRAVITY_LABEL.get(v, v) for v in regimes])
    ranges = []
    for column, name, unit in (("o2_percent", "O₂", " %"), ("pressure_kpa", "presión", " kPa")):
        numbers = [v for v in _column_values(columns, rows, column, unique=False) if isinstance(v, (int, float))]
        if numbers:
            low, high = min(numbers), max(numbers)
            ranges.append(
                f"{name} de {_fmt(low)}{unit}" if low == high else f"{name} entre {_fmt(low)} y {_fmt(high)}{unit}"
            )
    if ranges:
        text += ", con " + " y ".join(ranges)
    return text


def _column_values(columns: list[str], rows: list[list[Any]], name: str, unique: bool = True) -> list[Any]:
    if name not in columns:
        return []
    index = columns.index(name)
    values = [r[index] for r in rows if r[index] is not None]
    if not unique:
        return values
    return list(dict.fromkeys(values))


def _join(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " y " + parts[-1]


_TOKEN = re.compile(r"\w+", re.UNICODE)


def near_duplicate(first: str, second: str) -> bool:
    """True when two sentences say practically the same (one contains the other or most words match)."""
    a = {w for w in _TOKEN.findall(first.casefold()) if len(w) > 2}
    b = {w for w in _TOKEN.findall(second.casefold()) if len(w) > 2}
    if not a or not b:
        return False
    return len(a & b) / min(len(a), len(b)) >= 0.8 and len(a & b) / len(a | b) >= 0.6


_GRAVITY_MENTIONS = (
    ("microgravity", r"microgravedad|microgravity"),
    ("lunar", r"gravedad lunar|lunar|luna"),
    ("martian", r"gravedad marciana|marciana|marte|martian"),
    ("normal", r"gravedad normal|gravedad terrestre|terrestre"),
)


def conflicts_with_gravity(text: str, gravity: str | None) -> bool:
    """True when the text names a gravity regime other than the computed one."""
    lowered = text.casefold()
    mentioned = {g for g, words in _GRAVITY_MENTIONS if re.search(rf"\b(?:{words})\b", lowered)}
    return bool(mentioned - {gravity})


def default_evidence(queries: list[dict[str, Any]]) -> BriefEvidence | None:
    """The last recorded table, copied as is."""
    tables = [q for q in queries if q.get("columns") and q.get("rows")]
    if not tables:
        return None
    last = tables[-1]
    return BriefEvidence(
        title=EVIDENCE_TITLE,
        columns=last["columns"],
        rows=last["rows"],
        experiment_ids=experiment_ids(last["columns"], last["rows"]),
    )


def experiment_ids(columns: list[str], rows: list[list[Any]]) -> list[str]:
    """PSI ids of the `experiment_id` column or of the grouped `experimentos` column."""
    found: set[str] = set()
    for name in ("experiment_id", "experimentos"):
        if name in columns:
            index = columns.index(name)
            for row in rows:
                if isinstance(row[index], str):
                    found.update(re.findall(r"\bPSI-\d+\b", row[index]))
    return sorted(found)


def default_steps(gap: BriefGap | None, has_data: bool) -> list[BriefStep]:
    steps: list[BriefStep] = []
    if gap is not None or has_data:
        steps.append(default_step("simulate", gap))
    if gap is not None:
        steps.append(default_step("propose_experiment", gap))
    steps.append(default_step("explore_map", gap))
    return steps[:MAX_STEPS]


_STEP_LABELS = {
    "simulate": "Simular este escenario en el laboratorio",
    "propose_experiment": "Proponer un ensayo en esa región",
    "explore_map": "Ver estas condiciones en el mapa",
}


def default_step(kind: str, gap: BriefGap | None) -> BriefStep:
    params: dict[str, Any] = {"pressure_kpa": None, "o2_percent": None, "gravity": None, "material": None}
    if gap is not None and kind != "explore_map":
        params["pressure_kpa"] = _first(gap.pressure_kpa_min, gap.pressure_kpa_max)
        params["o2_percent"] = _first(gap.o2_percent_min, gap.o2_percent_max)
        params["gravity"] = gap.gravity
    return BriefStep(kind=kind, label=_STEP_LABELS[kind], **params)  # type: ignore[arg-type]


def default_lenses(gap: BriefGap | None, total: int | None) -> BriefLenses:
    scope = f" ({_records(total)})" if isinstance(total, int) and total > 0 else ""
    where = f" en {_GRAVITY_LABEL[gap.gravity]}" if gap is not None and gap.gravity else ""
    return BriefLenses(
        student=(
            "La llama depende del oxígeno, de la presión y de la gravedad: sin gravedad el aire caliente no sube "
            f"y la llama se comporta distinto. Piensa: ¿qué crees que pasaría{where or ' con menos oxígeno'}?"
        ),
        teacher=(
            f"Actividad: plantea una hipótesis sobre estas condiciones{where}. Cambia una sola variable "
            "(oxígeno, presión o gravedad) en el simulador y observa si la llama se sostiene, cambia de forma "
            "o se apaga."
        ),
        researcher=(
            f"Revisa los rangos de O₂ y presión de los datos{scope}, la base del O₂ (atmósfera o corriente de "
            "oxidante), los ensayos marcados para revisión y contrasta con las fuentes citadas."
        ),
    )


def build_rules_brief(
    classification: Classification, queries: list[dict[str, Any]], has_sources: bool, question: str
) -> BriefComponent:
    queries = [q for q in queries if q.get("columns")]
    gap, empty = compute_gap_ex(question, queries)
    evidence = default_evidence(queries)
    totals = [q["total"] for q in queries if isinstance(q.get("total"), int)]
    total = totals[-1] if totals else None
    return BriefComponent(
        type="brief",
        verdict=default_verdict(classification, queries, has_sources, empty),
        evidence=evidence,
        gap=gap,
        next_steps=default_steps(gap, evidence is not None),
        lenses=default_lenses(gap, total),
    )


def _bounds_from_question(question: str) -> dict[str, float | None]:
    o2_topic = bool(_O2_TOPIC.search(question))
    return {
        "o2_percent_min": _match(_O2_MIN, question) if o2_topic else None,
        "o2_percent_max": _match(_O2_MAX, question) if o2_topic else None,
        "pressure_kpa_min": _match(_PRESSURE_MIN, question),
        "pressure_kpa_max": _match(_PRESSURE_MAX, question),
    }


def _match(pattern: re.Pattern[str], text: str) -> float | None:
    found = pattern.search(text)
    return float(found.group(1).replace(",", ".")) if found else None


def _describe_condition(bounds: dict[str, float | None]) -> str:
    parts = []
    parts.extend(_range("O₂", " %", bounds["o2_percent_min"], bounds["o2_percent_max"]))
    parts.extend(_range("presión", " kPa", bounds["pressure_kpa_min"], bounds["pressure_kpa_max"]))
    return " y ".join(parts)


def _range(name: str, unit: str, low: float | None, high: float | None) -> list[str]:
    if low is not None and high is not None:
        return [f"{name} entre {_fmt(low)} y {_fmt(high)}{unit}"]
    if low is not None:
        return [f"{name} de al menos {_fmt(low)}{unit}"]
    if high is not None:
        return [f"{name} de hasta {_fmt(high)}{unit}"]
    return []


def _records(total: int) -> str:
    return "1 registro" if total == 1 else f"{total} registros"


def _fmt(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _first(*values: float | None) -> float | None:
    return next((v for v in values if v is not None), None)


def _single_gravity(value: Any) -> str | None:
    if isinstance(value, list) and len(value) == 1 and value[0] in BRIEF_GRAVITIES:
        return value[0]
    return None


def _gravity_from_question(question: str) -> str | None:
    text = question.casefold()
    found = [g for g, words in _GRAVITY_WORDS if any(re.search(rf"\b{w}\b", text) for w in words)]
    return found[0] if len(found) == 1 else None


def _missing_gravity(query: dict[str, Any] | None) -> str | None:
    """Lunar or martian regime absent from the grouped rows of the last query."""
    if not query or "gravity_environment" not in (query.get("columns") or []) or not query.get("rows"):
        return None
    index = query["columns"].index("gravity_environment")
    present = {r[index] for r in query["rows"]}
    return next((g for g in ("lunar", "martian") if g not in present), None)
