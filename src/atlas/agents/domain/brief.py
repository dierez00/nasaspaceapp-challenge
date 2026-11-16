"""Evidence brief built in Python: gap bounds, verdict, next steps and audience lenses.

Everything numeric in a brief is computed here from the question or from what the analyst
recorded, never by the LLM. The rules composer uses these builders directly; grounding uses
them to replace what the composer wrote when it is not backed by the data.
"""

import re
from typing import Any

from atlas.agents.domain.classification import Classification
from atlas.agents.domain.lang import DEFAULT_LANG, Lang
from atlas.agents.domain.ui import (
    BriefComponent,
    BriefEvidence,
    BriefGap,
    BriefLenses,
    BriefStep,
)

MAX_STEPS = 3
EVIDENCE_TITLE = "Ensayos consultados"
EVIDENCE_TITLES: dict[Lang, str] = {"es": EVIDENCE_TITLE, "en": "Trials queried"}
BRIEF_GRAVITIES = ("microgravity", "lunar", "martian", "normal")
_GRAVITY_LABELS: dict[Lang, dict[str, str]] = {
    "es": {
        "microgravity": "microgravedad",
        "lunar": "gravedad lunar",
        "martian": "gravedad marciana",
        "normal": "gravedad normal",
    },
    "en": {
        "microgravity": "microgravity",
        "lunar": "lunar gravity",
        "martian": "Martian gravity",
        "normal": "normal gravity",
    },
}
_GRAVITY_WORDS = (
    ("microgravity", ("microgravedad", "microgravity")),
    ("lunar", ("lunar", "luna", "moon")),
    ("martian", ("marciana", "marte", "martian", "mars")),
)
_MIN_WORDS = (
    r"(?:m[aá]s de|mayor(?:es)? (?:a|que|de)|por encima de|al menos"
    r"|more than|greater than|above|over|at least|>=|≥|>)"
)
_MAX_WORDS = (
    r"(?:menos de|menor(?:es)? (?:a|que|de)|por debajo de|como m[aá]ximo"
    r"|less than|lower than|below|under|at most|up to|<=|≤|<)"
)
_NUMBER = r"(\d+(?:[.,]\d+)?)"
_O2_MIN = re.compile(rf"{_MIN_WORDS}\s*{_NUMBER}\s*%")
_O2_MAX = re.compile(rf"{_MAX_WORDS}\s*{_NUMBER}\s*%")
_PRESSURE_MIN = re.compile(rf"{_MIN_WORDS}\s*{_NUMBER}\s*kpa", re.IGNORECASE)
_PRESSURE_MAX = re.compile(rf"{_MAX_WORDS}\s*{_NUMBER}\s*kpa", re.IGNORECASE)
_O2_TOPIC = re.compile(r"o2|o₂|ox[ií]geno|oxygen", re.IGNORECASE)


def _gravity_label(gravity: str, lang: Lang) -> str:
    return _GRAVITY_LABELS[lang].get(gravity, gravity)


def compute_gap(question: str, queries: list[dict[str, Any]], lang: Lang = DEFAULT_LANG) -> BriefGap | None:
    return compute_gap_ex(question, queries, lang)[0]


def compute_gap_ex(
    question: str, queries: list[dict[str, Any]], lang: Lang = DEFAULT_LANG
) -> tuple[BriefGap | None, bool]:
    """Returns the gap and whether it comes from a query that found no tests.

    Gap region from the recorded query filters (or the question), with a plain description.

    A gap exists when a recorded query with filters found no tests (the latest one wins), or
    when the grouped rows of the last query show a lunar or martian regime with no tests.
    """
    filtered = [q for q in queries if isinstance(q.get("filtros"), dict)]
    for query in reversed(filtered):
        bounds, gravity = _region(question, query)
        if query.get("total") == 0 and (any(v is not None for v in bounds.values()) or gravity):
            condition = _describe_condition(bounds, lang)
            if lang == "en":
                where = f" in {_gravity_label(gravity, lang)}" if gravity else ""
                what = f" with {condition}" if condition else " under those conditions"
                description = f"No trials recorded{what}{where}."
            else:
                where = f" en {_gravity_label(gravity, lang)}" if gravity else ""
                what = f" con {condition}" if condition else " con esas condiciones"
                description = f"No hay ensayos registrados{what}{where}."
            return BriefGap(description=description, gravity=gravity, **bounds), True

    last = filtered[-1] if filtered else None
    missing = _missing_gravity(last)
    if last is None or missing is None:
        return None, False
    bounds, _ = _region(question, last)
    condition = _describe_condition(bounds, lang)
    if lang == "en":
        what = f" with {condition}" if condition else " under these conditions"
        description = f"No trials in {_gravity_label(missing, lang)}{what}."
    else:
        what = f" con {condition}" if condition else " con estas condiciones"
        description = f"No hay ensayos en {_gravity_label(missing, lang)}{what}."
    return BriefGap(description=description, gravity=missing, **bounds), False


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


_VERDICTS: dict[Lang, dict[str, str]] = {
    "es": {
        "empty": "El Atlas no tiene ensayos con esas condiciones.",
        "gap": "{finding}; lo que queda fuera de estas condiciones es el hueco.",
        "sources": "Los informes de NASA PSI explican este tema y los fragmentos citados lo respaldan.",
        "nothing": "El Atlas no tiene datos ni documentos que respondan a esta pregunta.",
    },
    "en": {
        "empty": "The Atlas has no trials under those conditions.",
        "gap": "{finding}; what lies outside these conditions is the gap.",
        "sources": "NASA PSI reports explain this topic and the cited excerpts support it.",
        "nothing": "The Atlas has no data or documents that answer this question.",
    },
}


def default_verdict(
    classification: Classification,
    queries: list[dict[str, Any]],
    has_sources: bool,
    empty_region: bool = False,
    lang: Lang = DEFAULT_LANG,
) -> str:
    texts = _VERDICTS[lang]
    if empty_region:
        return texts["empty"]
    with_rows = [q for q in queries if q.get("total") is not None]
    if with_rows:
        last = with_rows[-1]
        total = last["total"]
        if total == 0:
            return texts["empty"]
        finding = _finding(last, lang)
        if classification.tipo == "huecos":
            return texts["gap"].format(finding=finding)
        return f"{finding}."
    if has_sources:
        return texts["sources"]
    return texts["nothing"]


def _noun(count: Any, lang: Lang) -> str:
    if lang == "en":
        return "trial" if count == 1 else "trials"
    return "ensayo" if count == 1 else "ensayos"


def _finding(query: dict[str, Any], lang: Lang = DEFAULT_LANG) -> str:
    """Professor-style finding with figures that are recorded cells or the recorded total."""
    en = lang == "en"
    filters = query.get("filtros") or {}
    material = filters.get("material") if isinstance(filters.get("material"), str) else None
    if en:
        subject = f"For {material}, the Atlas has" if material else "The Atlas has"
    else:
        subject = f"Para {material} hay" if material else "En el Atlas hay"
    at = " in " if en else " en "
    columns = query.get("columns") or []
    rows = query.get("rows") or []
    total = query["total"]

    if "ensayos" in columns and "gravity_environment" in columns and 0 < len(rows) <= 3:
        gi, ci = columns.index("gravity_environment"), columns.index("ensayos")
        parts = [
            (f"{r[ci]} {_noun(r[ci], lang)}{at}" if i == 0 else f"{r[ci]}{at}")
            + _gravity_label(str(r[gi]), lang)
            for i, r in enumerate(rows)
            if isinstance(r[ci], int) and isinstance(r[gi], str)
        ]
        if parts:
            return f"{subject} {_join(parts, lang)}"

    if "ensayos" in columns and rows:
        count = rows[0][columns.index("ensayos")]
        if len(rows) == 1 and isinstance(count, int):
            return f"{subject} {count} {_noun(count, lang)}"
        if en:
            return f"{subject} trials in {total} groups of the data"
        return f"{subject} ensayos en {total} grupos de los datos"

    complete = not query.get("truncated") and len(rows) == total and "ensayos" not in columns
    text = f"{subject} {total} {_noun(total, lang)}"
    if not complete or not rows:
        return text
    regimes = _column_values(columns, rows, "gravity_environment")
    if regimes and all(isinstance(v, str) for v in regimes):
        text += at + _join([_gravity_label(v, lang) for v in regimes], lang)
    ranges = []
    pressure = "pressure" if en else "presión"
    for column, name, unit in (("o2_percent", "O₂", " %"), ("pressure_kpa", pressure, " kPa")):
        numbers = [v for v in _column_values(columns, rows, column, unique=False) if isinstance(v, (int, float))]
        if numbers:
            low, high = min(numbers), max(numbers)
            if en:
                ranges.append(
                    f"{name} of {_fmt(low)}{unit}"
                    if low == high
                    else f"{name} between {_fmt(low)} and {_fmt(high)}{unit}"
                )
            else:
                ranges.append(
                    f"{name} de {_fmt(low)}{unit}" if low == high else f"{name} entre {_fmt(low)} y {_fmt(high)}{unit}"
                )
    if ranges:
        text += (", with " if en else ", con ") + (" and " if en else " y ").join(ranges)
    return text


def _column_values(columns: list[str], rows: list[list[Any]], name: str, unique: bool = True) -> list[Any]:
    if name not in columns:
        return []
    index = columns.index(name)
    values = [r[index] for r in rows if r[index] is not None]
    if not unique:
        return values
    return list(dict.fromkeys(values))


def _join(parts: list[str], lang: Lang = DEFAULT_LANG) -> str:
    last = " and " if lang == "en" else " y "
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + last + parts[-1]


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
    ("lunar", r"gravedad lunar|lunar|luna|moon"),
    ("martian", r"gravedad marciana|marciana|marte|martian|mars"),
    ("normal", r"gravedad normal|gravedad terrestre|terrestre|normal gravity|earth gravity|terrestrial"),
)


def conflicts_with_gravity(text: str, gravity: str | None) -> bool:
    """True when the text names a gravity regime other than the computed one."""
    lowered = text.casefold()
    mentioned = {g for g, words in _GRAVITY_MENTIONS if re.search(rf"\b(?:{words})\b", lowered)}
    return bool(mentioned - {gravity})


def default_evidence(queries: list[dict[str, Any]], lang: Lang = DEFAULT_LANG) -> BriefEvidence | None:
    """The last recorded table, copied as is."""
    tables = [q for q in queries if q.get("columns") and q.get("rows")]
    if not tables:
        return None
    last = tables[-1]
    return BriefEvidence(
        title=EVIDENCE_TITLES[lang],
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


def default_steps(gap: BriefGap | None, has_data: bool, lang: Lang = DEFAULT_LANG) -> list[BriefStep]:
    steps: list[BriefStep] = []
    if gap is not None or has_data:
        steps.append(default_step("simulate", gap, lang))
    if gap is not None:
        steps.append(default_step("propose_experiment", gap, lang))
    steps.append(default_step("explore_map", gap, lang))
    return steps[:MAX_STEPS]


_STEP_LABELS: dict[Lang, dict[str, str]] = {
    "es": {
        "simulate": "Simular este escenario en el laboratorio",
        "propose_experiment": "Proponer un ensayo en esa región",
        "explore_map": "Ver estas condiciones en el mapa",
    },
    "en": {
        "simulate": "Simulate this scenario in the lab",
        "propose_experiment": "Propose a trial in that region",
        "explore_map": "See these conditions on the map",
    },
}


def default_step(kind: str, gap: BriefGap | None, lang: Lang = DEFAULT_LANG) -> BriefStep:
    params: dict[str, Any] = {"pressure_kpa": None, "o2_percent": None, "gravity": None, "material": None}
    if gap is not None and kind != "explore_map":
        params["pressure_kpa"] = _first(gap.pressure_kpa_min, gap.pressure_kpa_max)
        params["o2_percent"] = _first(gap.o2_percent_min, gap.o2_percent_max)
        params["gravity"] = gap.gravity
    return BriefStep(kind=kind, label=_STEP_LABELS[lang][kind], **params)  # type: ignore[arg-type]


def default_lenses(gap: BriefGap | None, total: int | None, lang: Lang = DEFAULT_LANG) -> BriefLenses:
    scope = f" ({_records(total, lang)})" if isinstance(total, int) and total > 0 else ""
    if lang == "en":
        where = f" in {_gravity_label(gap.gravity, lang)}" if gap is not None and gap.gravity else ""
        return BriefLenses(
            student=(
                "A flame depends on oxygen, pressure and gravity: without gravity hot air does not rise "
                f"and the flame behaves differently. Think: what would happen{where or ' with less oxygen'}?"
            ),
            teacher=(
                f"Activity: state a hypothesis about these conditions{where}. Change a single variable "
                "(oxygen, pressure or gravity) in the simulator and watch whether the flame holds, changes shape "
                "or goes out."
            ),
            researcher=(
                f"Check the O₂ and pressure ranges in the data{scope}, the O₂ basis (atmosphere or oxidizer "
                "stream) and the trials flagged for review, and compare them with the cited sources."
            ),
        )
    where = f" en {_gravity_label(gap.gravity, lang)}" if gap is not None and gap.gravity else ""
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
    classification: Classification,
    queries: list[dict[str, Any]],
    has_sources: bool,
    question: str,
    lang: Lang = DEFAULT_LANG,
) -> BriefComponent:
    queries = [q for q in queries if q.get("columns")]
    gap, empty = compute_gap_ex(question, queries, lang)
    evidence = default_evidence(queries, lang)
    totals = [q["total"] for q in queries if isinstance(q.get("total"), int)]
    total = totals[-1] if totals else None
    return BriefComponent(
        type="brief",
        verdict=default_verdict(classification, queries, has_sources, empty, lang),
        evidence=evidence,
        gap=gap,
        next_steps=default_steps(gap, evidence is not None, lang),
        lenses=default_lenses(gap, total, lang),
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


def _describe_condition(bounds: dict[str, float | None], lang: Lang = DEFAULT_LANG) -> str:
    pressure = "pressure" if lang == "en" else "presión"
    parts = []
    parts.extend(_range("O₂", " %", bounds["o2_percent_min"], bounds["o2_percent_max"], lang))
    parts.extend(_range(pressure, " kPa", bounds["pressure_kpa_min"], bounds["pressure_kpa_max"], lang))
    return (" and " if lang == "en" else " y ").join(parts)


def _range(name: str, unit: str, low: float | None, high: float | None, lang: Lang = DEFAULT_LANG) -> list[str]:
    if lang == "en":
        if low is not None and high is not None:
            return [f"{name} between {_fmt(low)} and {_fmt(high)}{unit}"]
        if low is not None:
            return [f"{name} of at least {_fmt(low)}{unit}"]
        if high is not None:
            return [f"{name} up to {_fmt(high)}{unit}"]
        return []
    if low is not None and high is not None:
        return [f"{name} entre {_fmt(low)} y {_fmt(high)}{unit}"]
    if low is not None:
        return [f"{name} de al menos {_fmt(low)}{unit}"]
    if high is not None:
        return [f"{name} de hasta {_fmt(high)}{unit}"]
    return []


def _records(total: int, lang: Lang = DEFAULT_LANG) -> str:
    if lang == "en":
        return "1 record" if total == 1 else f"{total} records"
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
