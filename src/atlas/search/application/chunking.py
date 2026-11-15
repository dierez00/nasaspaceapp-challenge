"""Turn the PSI files under data/ into citable text chunks."""

import csv
import io
import json
from pathlib import Path

from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.experiments.domain.experiment import Experiment, ExperimentTest
from atlas.search.domain.chunk import Chunk

CSV_ROWS_PER_CHUNK = 8


def build_chunks(data_dir: Path) -> list[Chunk]:
    if not data_dir.is_dir() or not (data_dir / "experiments").is_dir():
        raise ValueError("Data directory and its experiments directory must exist; index unchanged")
    results = load_experiment_files(data_dir / "experiments")
    if not results:
        raise ValueError("No experiment JSON files found; index unchanged")
    invalid = [result.file for result in results if not result.ok]
    if invalid:
        raise ValueError(f"Invalid experiment files: {', '.join(invalid)}; index unchanged")
    chunks: list[Chunk] = []
    for result in results:
        chunks.extend(experiment_chunks(result.experiment))
    sources_file = data_dir / "search" / "sources.json"
    if sources_file.exists():
        chunks.extend(search_source_chunks(json.loads(sources_file.read_text(encoding="utf-8"))))
    chunks.extend(csv_chunks(data_dir / "raw"))
    if not chunks:
        raise ValueError("Refusing to synchronize an empty corpus; index unchanged")
    return _dedupe(chunks)


def experiment_chunks(experiment: Experiment) -> list[Chunk]:
    sources = "\n".join(f"- {s.file}" + (f" ({s.url})" if s.url else "") for s in experiment.sources)
    overview = "\n".join(
        line
        for line in (
            f"{experiment.id} - {experiment.title}" + (f" ({experiment.acronym})" if experiment.acronym else ""),
            f"Research area: {experiment.research_area}",
            f"Platform: {experiment.platform}",
            f"Principal investigator: {experiment.principal_investigator}" if experiment.principal_investigator else "",
            f"DOI: {experiment.doi}" if experiment.doi else "",
            f"Summary: {experiment.summary}",
            f"Sources:\n{sources}",
        )
        if line
    )
    chunks = [Chunk(experiment.id, f"{experiment.id}.json", "overview", overview)]
    chunks += [
        Chunk(experiment.id, t.source.file, f"test {t.test_id} ({t.source.locator})", _describe_test(experiment, t))
        for t in experiment.tests
    ]
    return chunks


def _describe_test(experiment: Experiment, t: ExperimentTest) -> str:
    kind = f"flammability limit ({t.limit_type})" if t.point_type == "limit" else "test"
    parts = [
        f"{experiment.id} {experiment.acronym or experiment.title}, {kind} {t.test_id}.",
        f"Material: {t.material} ({t.material_class})"
        + (f", thickness {t.thickness_mm} mm." if t.thickness_mm is not None else "."),
        f"Conditions: {t.o2_percent}% O2, {t.pressure_kpa} kPa, {t.gravity_environment} ({t.gravity_g} g)"
        + (f", {t.flow_direction} flow at {t.flow_velocity_cm_s} cm/s." if t.flow_velocity_cm_s is not None else "."),
        f"Outcome: {t.outcome.replace('_', ' ')}"
        + (f", burn length {t.burn_length_cm} cm" if t.burn_length_cm is not None else "")
        + (f", spread rate {t.spread_rate_mm_s} mm/s." if t.spread_rate_mm_s is not None else "."),
    ]
    ref = t.normal_gravity_reference
    if ref:
        parts.append(f"Normal gravity reference: {ref.outcome.replace('_', ' ')}" + (f" ({ref.note})" if ref.note else "."))
    if t.derived_from:
        parts.append(f"Derived from runs: {', '.join(t.derived_from)}.")
    if t.notes:
        parts.append(f"Notes: {t.notes}")
    parts.append(f"Source: {t.source.file}, {t.source.locator}. Confidence: {t.confidence}.")
    return "\n".join(parts)


def search_source_chunks(payload: dict) -> list[Chunk]:
    chunks: list[Chunk] = []
    for src in payload.get("sources", []):
        pid = src["id"]
        title = src["title"] + (f" ({src['acronym']})" if src.get("acronym") else "")
        overview = [f"{pid} - {title}", f"Why it is search-only: {src['reason']}"]
        if src.get("topics"):
            overview.append(f"Topics: {', '.join(src['topics'])}")
        if src.get("doi"):
            overview.append(f"DOI: {src['doi']}")
        overview.append(f"Source: {src['source_url']}")
        chunks.append(Chunk(pid, "sources.json", "overview", "\n".join(overview)))
        pubs = src.get("publications", [])
        if pubs:
            lines = [f"{pid} publications:"] + [
                f"- {p['title']}" + (f" (DOI {p['doi']})" if p.get("doi") else "") for p in pubs
            ]
            chunks.append(Chunk(pid, "sources.json", "publications", "\n".join(lines)))
    return chunks


def csv_chunks(raw_dir: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    for path in sorted(raw_dir.glob("*/*.csv")):
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        rows = [r for r in csv.DictReader(io.StringIO(text)) if any((v or "").strip() for v in r.values())]
        for start in range(0, len(rows), CSV_ROWS_PER_CHUNK):
            group = rows[start : start + CSV_ROWS_PER_CHUNK]
            body = "\n".join(_format_row(r) for r in group)
            header = f"{path.parent.name} raw table {path.name}, rows {start + 1}-{start + len(group)}:"
            chunks.append(Chunk(path.parent.name, path.name, f"rows {start + 1}-{start + len(group)}", f"{header}\n{body}"))
    return chunks


def _format_row(row: dict[str, str | None]) -> str:
    return "; ".join(f"{k.strip()}: {v.strip()}" for k, v in row.items() if k and v and v.strip())


def _dedupe(chunks: list[Chunk]) -> list[Chunk]:
    return list({c.key: c for c in chunks}.values())
