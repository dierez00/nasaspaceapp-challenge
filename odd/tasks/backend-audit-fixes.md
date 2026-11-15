# Backend audit fixes

Apply the four audited correctness fixes without removing research records or changing the teammate's agent/query features.

## Scope and authorization
- User authorized separate Conventional Commits on the existing `backend` branch and a normal push to that branch; do not touch `main`, open PRs, force-push, or use AI commit attribution.
- Start boundary: `9f0365ded6c2e1a2bd812c437699a5c8563e3519`.
- Preserve teammate changes through this boundary, all citations, raw files, and unfiltered experiment access.
- No live database changes, indexing, provider requests, credential inspection, or remote operations by workers. Parent owns the final authorized Git push.
- Existing untracked `.atl/` and `.codegraph/` are not deliverables.

## Why
The audit demonstrated destructive empty-source synchronization, ambiguous atmospheric oxygen comparisons, long query retries holding shared connections, and missing per-investigation test ID uniqueness.

## Execution
- Route: delegated direct, one sequential writer; no SDD.
- TDD: off, as explicitly recorded in existing `odd/tasks/search-reranker.md`, `coverage-gap-map.md`, and `rag-ingestion.md`; ordinary functional checks are required.
- Runner: `.venv/bin/python -m pytest`, using the isolated process below.
- Receipt-driven development: off (global, observed 2026-11-15); do not enable it.
- Delivery strategy: `ask-on-risk`; the human resolved the size question by directing separate commits pushed to `backend`, not PRs. PR chain strategy is not applicable to this authorized delivery.
- Forecast: approximately 635–930 authored changed lines plus this document; generated JSON Schema excluded. Four coherent fix commits, not cosmetic splitting or test reductions.

## Tasks
- [x] T1 Protect the existing search index when input directories are missing, records are invalid, or the resulting corpus is unexpectedly empty. Fail before repository mutation; test preservation and CLI behavior.
- [ ] T2 Bound query-provider latency without removing ingestion retries, and acquire Postgres connections only for SQL in both `/search` and the existing researcher adapter. Test provider failures, timeout/fallback, and connection lifetime.
- [ ] T3 Distinguish ambient oxygen from oxidizer-stream oxygen with explicit backward-compatible point metadata. Annotate the 153 PSI-159 inverse-flame points using their cited inverse CSV, persist the metadata, exclude stream oxygen from atmospheric filters/coverage, preserve it in full records and RAG with an explicit label, and document the database upgrade.
- [ ] T4 Reject duplicate `test_id` values within an investigation before database writes. Test validation and loader reporting.

## Acceptance and checks
- Every task includes focused regression tests and a separate work-unit commit with its observed results.
- Existing local tests remain green, including teammate `tests/test_query.py`.
- Missing/invalid input never silently prunes an existing index.
- Query retries cannot enter the 8-attempt ingestion backoff; embedding/reranking never holds a pooled SQL connection.
- Atmospheric comparisons cannot count inverse-flame oxidizer O2 as ambient evidence; raw scientific observations and citations remain available.
- Document an idempotent schema upgrade and JSON reload; do not run `atlas-load` or `atlas-index` on the user's database.
- Generated experiment JSON Schema remains in sync; do not bump contract version unnecessarily.
- Parent structurally reads the diff, assesses verification risk with the native read-only assessment, runs an independent verifier when required, and spot-replays a reported test command.

### Safe full-suite command
```bash
env -u VOYAGE_API_KEY -u CLAUDE_CODE_OAUTH_TOKEN -u ATLAS_TEST_DATABASE_URL \
  -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \
  DATABASE_URL=postgresql://nobody:x@127.0.0.1:1/none \
  AGENTS_MOCK=true QUERY_CACHE_ENABLED=false PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -B - <<'PY'
from atlas.shared.config import Settings
Settings.model_config["env_file"] = None
import pytest
raise SystemExit(pytest.main(["-q", "-rs", "-p", "no:cacheprovider"]))
PY
```
Focused checks use the same isolation and append the relevant test paths to `pytest.main`.

## Progress and evidence
- Planning: tracked worktree clean at the start boundary; preexisting untracked tooling directories preserved.
- Current integrated-suite baseline: 102 passed, 3 database-dependent skips (isolated full-suite command above).
- T1: input guards and CLI abort before database connection; direct empty synchronization is rejected. Focused: isolated pytest `tests/test_index_safety.py tests/test_search.py` — 12 passed, 1 database skip. Full suite: 109 passed, 3 database skips. `git diff --check`: clean.
  - Runtime harness: offline CLI `_run()` test rejects invalid sources before a mocked connect; repository spy confirms zero calls for an empty sync. No live index execution.
  - Rollback boundary: chunking/index input guards, their dedicated tests and README protection guidance; normal incremental removal/resume retained.
  - Commit: pending creation in this work unit.
- T2: pending.
- T3: pending.
- T4: pending.
- Native risk assessment / independent checks: pending.
- Running authored line count and commit identities: pending.
- Remote push: pending parent verification.

## Next step
Run the isolated baseline, then implement T1–T4 sequentially. Update this document and its Engram recovery mirror after each task, recording exact commands/results, runtime harness or justified N/A, rollback boundary, and commit identities.

