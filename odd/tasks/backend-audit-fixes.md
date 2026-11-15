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
- [x] T2 Bound query-provider latency without removing ingestion retries, and acquire Postgres connections only for SQL in both `/search` and the existing researcher adapter. Test provider failures, timeout/fallback, and connection lifetime.
- [x] T3 Distinguish ambient oxygen from oxidizer-stream oxygen with explicit backward-compatible point metadata. Annotate the 153 PSI-159 inverse-flame points using their cited inverse CSV, persist the metadata, exclude stream oxygen from atmospheric filters/coverage, preserve it in full records and RAG with an explicit label, and document the database upgrade.
- [x] T4 Reject duplicate `test_id` values within an investigation before database writes. Test validation and loader reporting.

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
  - Commit: `d15b59199507ff8ae4a67871cf527d581be41478`; 155 authored additions + deletions including initial tracking document.
- T2: interactive embedding bypasses ingestion backoff, with 4 s embedding / 2 s rerank deadlines; sanitized 503 and vector fallback. Both HTTP and researcher borrow SQL connections only inside the pooled search adapter.
  - Focused: isolated pytest `tests/test_search_latency.py tests/test_rerank.py tests/test_query.py` — 71 passed. Full suite: 117 passed, 3 database skips. `git diff --check`: clean.
  - Runtime harness: TestClient HTTP failure/deadline and provider/pool probes; researcher adapter same probe; SQL cancellation/error context cleanup; simulated quota retry keeps eight ingestion attempts without sleeping.
  - Rollback boundary: provider deadlines/query embedding path, pooled chunk search and its HTTP/researcher wiring, latency tests and README guidance. Existing query orchestration unchanged.
  - Commit: `0059576bd4ead50760baa08dd0e4cdd2a2680674`; 222 authored additions + deletions.
- T3: additive contract 1.1 `o2_basis` persisted in JSON/flat rows; exactly 153 inverse-source points annotated, scientific record canonical digest unchanged after removing only this new field. Atmospheric filters and each public coverage domain entrypoint exclude oxidizer streams; unfiltered records/RAG retain them with explicit oxygen labels.
  - Focused: isolated pytest `tests/test_oxygen_basis.py tests/test_coverage.py tests/test_experiment_filters.py tests/test_search.py` — 43 passed, 2 database skips. Full suite: 127 passed, 3 database skips. `atlas-validate`: 13/13 valid; generated schema equality asserted. `git diff --check`: clean.
  - Runtime harness: existing TestClient experiment/coverage cases and SQL writer/reader spies; schema/backfill source-bound structural checks. Live migration/index refresh NOT executed. Exact-source legacy JSON compatibility prevents pre-reload atmospheric misclassification.
  - Rollback boundary: oxygen metadata in model, PSI-159, schema and export, atmospheric filter/coverage guards, labeled chunks and oxygen regression tests/docs; additive database column can remain when reverting application code.
  - Data totals: all 1115 observations retained, 962 atmospheric coverage points; lunar filter PSI-159 45 → 18 and PSI-20 remains 13. No blanket gas exclusion. Required operator `atlas-load` then `atlas-index` documented.
  - Commit: `99986385da237bccbbc6bfd8cf433fba4004144b`; 375 authored additions + deletions (10 generated schema lines excluded).
- T4: per-investigation test ID uniqueness rejected during model validation with the duplicate identifiers; IDs may repeat across investigations. Invalid/empty loader batches report file/issues and fail before database connection, not after a partial load.
  - Focused: isolated pytest `tests/test_experiments.py tests/test_index_safety.py tests/test_oxygen_basis.py` — 26 passed. Full suite: 131 passed, 3 database skips. `atlas-validate`: 13/13 valid; generated schema equality test passes. `git diff --check`: clean.
  - Runtime harness: offline loader `_run()` with mixed valid/invalid files asserts no connection; repository spy confirms no invalid upsert. No live loader execution.
  - Rollback boundary: uniqueness validator/schema description, loader preflight, duplicate regression tests and corresponding README guidance; no database schema rollback required.
  - Commit: `8b691f661be6b2c30e766a38134cb8fd05593112`; 91 authored additions + deletions (1 generated schema line excluded).
- Native risk assessment / independent checks: pending.
- Running authored line count: 843 additions + deletions in T1–T4, including tracking changes and excluding 11 generated schema lines; final tracking-only commit follows. Commit identities recorded per task.
- Remote push: pending parent verification.

## Next step
Parent checks the completed commits, performs native read-only risk assessment, independent verification and a spot replay; then performs the authorized normal push to `backend`. Live database load/index refresh remains an explicit operator action.
