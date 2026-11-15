"""Filters and groups the tests of validated Experiment records in Python.

This is what the analyst agent queries: no SQL, only structured filters
validated by FiltroEnsayos. Pure functions, no I/O.
"""

import statistics
from collections import defaultdict
from collections.abc import Iterable
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from atlas.experiments.domain.experiment import (
    BurnOutcome,
    Experiment,
    FlowDirection,
    GravityEnvironment,
    LimitType,
    MaterialClass,
    PointType,
)

MAX_ROWS = 50

# ambient = atmosphere of the chamber or habitat; oxidizer_stream = oxidizer stream of a burner
# (PSI-159 inverse flames). Same split as the contract (ExperimentTest.o2_basis).
O2Basis = Literal["ambient", "oxidizer_stream"]
AMBIENT: list[O2Basis] = ["ambient"]

COLUMNS = (
    "experiment_id",
    "test_id",
    "point_type",
    "limit_type",
    "material",
    "material_class",
    "thickness_mm",
    "o2_percent",
    "o2_basis",
    "o2_status",
    "pressure_kpa",
    "pressure_status",
    "gravity_environment",
    "gravity_g",
    "flow_velocity_cm_s",
    "flow_direction",
    "outcome",
    "burn_length_cm",
    "spread_rate_mm_s",
    "confidence",
    "needs_review",
)

GroupField = Literal[
    "experiment_id",
    "point_type",
    "limit_type",
    "material",
    "material_class",
    "o2_percent",
    "o2_basis",
    "pressure_kpa",
    "gravity_environment",
    "flow_direction",
    "outcome",
    "confidence",
]
NumericField = Literal[
    "thickness_mm",
    "o2_percent",
    "pressure_kpa",
    "gravity_g",
    "flow_velocity_cm_s",
    "burn_length_cm",
    "spread_rate_mm_s",
]
GROUP_COLUMNS = ("ensayos", "experimentos")
METRIC_SUFFIXES = ("promedio", "min", "max")


class FiltroEnsayos(BaseModel):
    """Every field is optional; lists mean "any of these values"."""

    model_config = ConfigDict(extra="forbid")

    experiment_ids: list[Annotated[str, Field(pattern=r"^PSI-\d+$")]] | None = None
    point_type: list[PointType] | None = Field(
        default=None, description="test = ensayo individual; limit = límite de inflamabilidad derivado de varios"
    )
    limit_type: list[LimitType] | None = None
    material: str | None = Field(default=None, description="Texto contenido en el material, sin distinguir mayúsculas")
    material_class: list[MaterialClass] | None = None
    gravity_environment: list[GravityEnvironment] | None = None
    outcome: list[BurnOutcome] | None = None
    flow_direction: list[FlowDirection] | None = None
    o2_basis: list[O2Basis] | None = Field(
        default=None,
        description=(
            "ambient = O2 de la atmósfera; oxidizer_stream = O2 de la corriente de oxidante de un quemador "
            "(PSI-159, llamas inversas), no es una atmósfera. Si indicas o2_min, o2_max o un rango de presión "
            "y no indicas o2_basis, solo se consideran ensayos ambient"
        ),
    )
    o2_min: float | None = Field(default=None, description="O2 mínimo en %, inclusive")
    o2_max: float | None = Field(default=None, description="O2 máximo en %, inclusive")
    presion_min_kpa: float | None = None
    presion_max_kpa: float | None = None
    solo_revisados: bool = Field(default=False, description="Excluye ensayos con needs_review = true")
    agrupar_por: Annotated[list[GroupField], Field(max_length=3)] = Field(
        default_factory=list,
        description="Si se indica, devuelve conteos por grupo en vez de filas",
    )
    metricas: Annotated[list[NumericField], Field(max_length=4)] = Field(
        default_factory=list,
        description="Promedio, mínimo y máximo de estos campos (ignora vacíos); por grupo, o en total si no hay agrupar_por",
    )
    correlacion: tuple[NumericField, NumericField] | None = Field(
        default=None,
        description="Correlación de Pearson entre dos campos sobre los ensayos filtrados",
    )


def flatten(experiments: Iterable[Experiment]) -> list[dict[str, Any]]:
    """One dict per test with the experiment id, same columns as the experiment_tests table."""
    return [
        {"experiment_id": e.id, **{c: getattr(t, c) for c in COLUMNS if c != "experiment_id"}}
        for e in experiments
        for t in e.tests
    ]


def effective_o2_basis(f: FiltroEnsayos) -> list[O2Basis] | None:
    """The o2_basis the query really applies. Ranges of O2 or pressure describe an atmosphere, so
    without an explicit o2_basis they only look at ambient tests (same rule as GET /experiments)."""
    if f.o2_basis is not None:
        return f.o2_basis
    atmospheric = (f.o2_min, f.o2_max, f.presion_min_kpa, f.presion_max_kpa)
    return AMBIENT if any(v is not None for v in atmospheric) else None


def matches(row: dict[str, Any], f: FiltroEnsayos) -> bool:
    basis = effective_o2_basis(f)
    checks = [
        basis is None or row["o2_basis"] in basis,
        f.experiment_ids is None or row["experiment_id"] in f.experiment_ids,
        f.point_type is None or row["point_type"] in f.point_type,
        f.limit_type is None or row["limit_type"] in f.limit_type,
        f.material is None or f.material.casefold() in row["material"].casefold(),
        f.material_class is None or row["material_class"] in f.material_class,
        f.gravity_environment is None or row["gravity_environment"] in f.gravity_environment,
        f.outcome is None or row["outcome"] in f.outcome,
        f.flow_direction is None or row["flow_direction"] in f.flow_direction,
        f.o2_min is None or row["o2_percent"] >= f.o2_min,
        f.o2_max is None or row["o2_percent"] <= f.o2_max,
        f.presion_min_kpa is None or row["pressure_kpa"] >= f.presion_min_kpa,
        f.presion_max_kpa is None or row["pressure_kpa"] <= f.presion_max_kpa,
        not f.solo_revisados or not row["needs_review"],
    ]
    return all(checks)


def consultar(experiments: Iterable[Experiment], f: FiltroEnsayos) -> dict[str, Any]:
    """Returns {"columns", "rows", "total", "truncated"} plus "correlacion" when asked.

    - agrupar_por: one row per group with counts and the requested metrics.
    - metricas without agrupar_por: one summary row over all filtered tests.
    - otherwise: the filtered tests, one list per row in COLUMNS order.
    """
    rows = [row for row in flatten(experiments) if matches(row, f)]
    if f.agrupar_por or f.metricas:
        columns, table = _group(rows, f.agrupar_por, f.metricas)
    else:
        columns, table = list(COLUMNS), [[row[c] for c in COLUMNS] for row in rows]
    result: dict[str, Any] = {
        "columns": columns,
        "rows": table[:MAX_ROWS],
        "total": len(table),
        "truncated": len(table) > MAX_ROWS,
    }
    if f.correlacion:
        result["correlacion"] = _correlation(rows, *f.correlacion)
    result["o2_basis"] = _o2_basis_report(rows, f)
    return result


def _o2_basis_report(rows: list[dict[str, Any]], f: FiltroEnsayos) -> dict[str, Any]:
    """Makes the basis of every O2 figure visible: what was applied, how many tests of each basis
    the result covers, and a warning when ambient and oxidizer_stream O2 end up mixed."""
    applied = effective_o2_basis(f)
    counts = {basis: sum(1 for r in rows if r["o2_basis"] == basis) for basis in ("ambient", "oxidizer_stream")}
    report: dict[str, Any] = {
        "aplicado": applied,
        "por_defecto": applied is not None and f.o2_basis is None,
        "ensayos": counts,
    }
    uses_o2 = "o2_percent" in (*f.agrupar_por, *f.metricas, *(f.correlacion or ()))
    if uses_o2 and all(counts.values()) and "o2_basis" not in f.agrupar_por:
        report["advertencia"] = (
            "El O2 mezcla atmósfera (ambient) y corriente de oxidante (oxidizer_stream): "
            "filtra o2_basis o agrupa por o2_basis antes de hablar de atmósferas."
        )
    return report


def _group(
    rows: list[dict[str, Any]], fields: list[str], metrics: list[str]
) -> tuple[list[str], list[list[Any]]]:
    groups: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[tuple(row[f] for f in fields)].append(row)
    if not fields and not groups:
        groups[()] = []
    table = []
    for key in sorted(groups, key=lambda k: tuple((v is None, str(v)) for v in k)):
        members = groups[key]
        cells: list[Any] = [*key, len(members), ", ".join(sorted({r["experiment_id"] for r in members}))]
        for metric in metrics:
            values = [r[metric] for r in members if r[metric] is not None]
            cells += [round(statistics.fmean(values), 4), min(values), max(values)] if values else [None, None, None]
        table.append(cells)
    metric_columns = [f"{m}_{suffix}" for m in metrics for suffix in METRIC_SUFFIXES]
    return [*fields, *GROUP_COLUMNS, *metric_columns], table


def _correlation(rows: list[dict[str, Any]], x: str, y: str) -> dict[str, Any]:
    pairs = [(r[x], r[y]) for r in rows if r[x] is not None and r[y] is not None]
    result: dict[str, Any] = {"x": x, "y": y, "n": len(pairs), "pearson": None}
    if len(pairs) < 3:
        result["nota"] = "Se necesitan al menos 3 ensayos con ambos valores."
        return result
    try:
        result["pearson"] = round(statistics.correlation(*zip(*pairs, strict=True)), 4)
    except statistics.StatisticsError:
        result["nota"] = "Uno de los campos no varía en estos ensayos."
    return result
