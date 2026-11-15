"""Separate burner oxidizer composition from comparable atmospheric evidence."""

import asyncio
import json
import hashlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from atlas.coverage.domain.coverage import CoveragePoint, build_coverage_map, build_regime_coverage, evaluate_condition
from atlas.coverage.infrastructure.postgres_point_reader import PostgresPointReader
from atlas.experiments.application.filter_experiments import PointFilter, filter_experiments
from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.experiments.domain.experiment import Experiment, ExperimentTest
from atlas.experiments.infrastructure.postgres_repository import PostgresExperimentRepository, _TEST_COLUMNS
from atlas.search.application.chunking import experiment_chunks

ROOT = Path(__file__).resolve().parents[1]
INVERSE_SOURCE = "PSI-159_Experimental table_CFI-G_Inverse Flames.csv"


def inverse_record():
    raw = json.loads((ROOT / "data/experiments/PSI-159.json").read_text())
    return raw, next(t for t in raw["tests"] if t["source"]["file"] == INVERSE_SOURCE)


def test_exact_inverse_source_has_explicit_metadata_and_no_measurement_changes():
    current, _ = inverse_record()
    # Canonical record digest at 9f0365d; no Git history required in shallow CI.
    baseline_digest = "94f01b996c1ee0ded27974e58b2191db528dcd44c308acda4f58032da674e74b"
    assert len(current["tests"]) == 326
    streams = [t for t in current["tests"] if t.get("o2_basis") == "oxidizer_stream"]
    assert len(streams) == 153
    assert all(t["source"]["file"] == INVERSE_SOURCE for t in streams)
    cleaned = {**current, "tests": [{k: v for k, v in t.items() if k != "o2_basis"} for t in current["tests"]]}
    assert hashlib.sha256(json.dumps(cleaned, sort_keys=True, separators=(",", ":")).encode()).hexdigest() == baseline_digest


def test_legacy_json_uses_exact_source_identity_and_default_remains_ambient():
    _, inverse = inverse_record()
    legacy = {k: v for k, v in inverse.items() if k != "o2_basis"}
    assert ExperimentTest.model_validate(legacy).o2_basis == "oxidizer_stream"
    unrelated = {**legacy, "source": {"file": "other.csv", "locator": "row 1"}}
    assert ExperimentTest.model_validate(unrelated).o2_basis == "ambient"
    with pytest.raises(ValidationError, match="o2_basis"):
        ExperimentTest.model_validate({**legacy, "o2_basis": "unknown"})


@pytest.mark.parametrize("bounds", [dict(min_o2_percent=0), dict(max_pressure_kpa=1000)])
def test_atmospheric_bounds_exclude_streams_but_assumption_filter_is_independent(bounds):
    raw, _ = inverse_record()
    e = Experiment.model_validate(raw)
    assert len(filter_experiments([e], PointFilter())[0].tests) == 326
    ambient = filter_experiments([e], PointFilter(**bounds))[0].tests
    assert len(ambient) == 173 and all(t.o2_basis == "ambient" for t in ambient)
    measured = filter_experiments([e], PointFilter(exclude_assumed=True))[0].tests
    assert len(measured) == 326
    assert any(t.o2_basis == "oxidizer_stream" for t in measured)


def test_all_coverage_entrypoints_reject_stream_evidence():
    from atlas.coverage.domain.reference import ReferenceCondition
    source = {"title": "t", "publisher": "p", "url": None, "locator": "l"}
    condition = ReferenceCondition(id="reference", name="t", description="d", gravity_environment="lunar",
        gravity_g=0.165, o2_percent=34, pressure_kpa=56.5, gravity_sources=[source], atmosphere_sources=[source])
    point = CoveragePoint("PSI-159", "x", "test", "gas", 34, "reported", 56.5,
        "reported", 0.165, "complete_burn", False, "oxidizer_stream")
    assert evaluate_condition(condition, [point]).gap_reason == "no_points"
    assert all(regime.point_count == 0 for regime in build_regime_coverage([point]))
    coverage = build_coverage_map([point], [condition])
    assert coverage.totals.points == 0 and coverage.totals.experiments == 0


def test_full_dataset_kept_but_coverage_totals_are_atmospheric():
    experiments = [r.experiment for r in load_experiment_files(ROOT / "data/experiments")]
    fields = CoveragePoint.__dataclass_fields__
    points = [CoveragePoint(experiment_id=e.id, **{k: getattr(t, k) for k in fields if k != "experiment_id"})
              for e in experiments for t in e.tests]
    assert len(points) == 1115
    assert build_coverage_map(points, []).totals.points == 962
    assert len(experiments) == 13


def test_streams_remain_citable_in_index_with_explicit_basis():
    raw, inverse = inverse_record()
    chunks = experiment_chunks(Experiment.model_validate(raw))
    hit = next(c for c in chunks if c.section.startswith(f"test {inverse['test_id']} ("))
    assert hit.source_file == INVERSE_SOURCE
    assert "O2 (oxidizer_stream)" in hit.content


def test_flat_writer_and_full_json_both_persist_basis():
    from contextlib import asynccontextmanager
    raw, _ = inverse_record()
    execute = AsyncMock()
    executemany = AsyncMock()

    @asynccontextmanager
    async def context(value=None):
        yield value

    conn = SimpleNamespace(execute=execute, transaction=context,
        cursor=lambda: context(SimpleNamespace(executemany=executemany)))
    asyncio.run(PostgresExperimentRepository(conn).upsert(Experiment.model_validate(raw)))
    record_json = execute.call_args_list[0].args[1][-1].obj
    assert sum(t["o2_basis"] == "oxidizer_stream" for t in record_json["tests"]) == 153
    sql, rows = executemany.call_args.args
    assert "o2_basis" in sql
    assert sum(row[1 + _TEST_COLUMNS.index("o2_basis")] == "oxidizer_stream" for row in rows) == 153


def test_sql_reader_filters_basis_and_schema_backfill_is_source_bound():
    conn = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(fetchall=AsyncMock(return_value=[]))))
    assert asyncio.run(PostgresPointReader(conn).list_points("gas")) == []
    sql, params = conn.execute.call_args.args
    assert "o2_basis = 'ambient'" in sql
    assert params == ("gas", "gas")
    schema = (ROOT / "db/schema.sql").read_text()
    assert "add column if not exists o2_basis" in schema
    assert INVERSE_SOURCE in schema and "jsonb_array_elements" in schema
    assert "t.o2_basis <> 'oxidizer_stream'" in schema


def test_generated_contract_schema_is_current_and_version_unchanged():
    assert json.loads((ROOT / "data/schema/experiment.schema.json").read_text()) == Experiment.model_json_schema()
    assert Experiment.model_json_schema()["properties"]["schema_version"]["const"] == "1.1"
