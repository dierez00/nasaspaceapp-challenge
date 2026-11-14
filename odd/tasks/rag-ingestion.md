# RAG ingestion (search module)

## Objective
Build an idempotent pipeline that turns the PSI data already in `data/` into Voyage embeddings stored in pgvector, plus a search endpoint that returns cited chunks.

## Problem / why
`db/schema.sql` already defines `document_chunks` (vector(1024), HNSW) but `src/atlas/search/` is empty. The team is still capturing PSI records; the pipeline must work now with PSI-25/26/99/107 and simply be re-run when new files land.

## Scope
- Sources: `data/experiments/*.json`, `data/search/sources.json`, `data/raw/**/*.csv`.
- Chunking with citation metadata (PSI id, source file, section).
- Voyage embeddings (document vs query input types), batched.
- Idempotent upsert keyed by content hash (re-runs skip unchanged chunks, remove stale ones).
- CLI `atlas-index` and `POST /search` returning top-k chunks with citations.

## Out of scope
Reranker, agents, frontend, PDF parsing.

## Constraints
- Clean Architecture as in `src/atlas/experiments/` (domain / application / infrastructure / api).
- Secrets only via `Settings.voyage_api_key`; never logged.
- Tests must not call the network (fake embedder).
- `db/schema.sql` stays idempotent.

## Decisions
- Drop the FK `document_chunks.experiment_id -> experiments(id)`: search-only sources (PSI-107) are not map experiments.
- TDD: no project/session config found → ordinary functional checks. Runner: `.venv/bin/python -m pytest`.

## Tasks
- [x] T1 Schema: drop FK, add `content_hash` + uniqueness; add `voyageai` dependency and embedding settings.
- [x] T2 Domain + application: chunk model, chunkers per source type, embedder port, indexing use case with hash-based diff.
- [x] T3 Infrastructure: Voyage embedder adapter, Postgres chunk repository; `atlas-index` CLI.
- [x] T4 API: `POST /search` with citations.
- [x] T5 Tests + README section; live smoke run against local pgvector (needs `docker compose up -d db`).

## Acceptance criteria
- `atlas-index` run twice: second run embeds 0 chunks.
- `POST /search` returns chunks with PSI id and source file.
- `pytest` green without network.

## Checks
`.venv/bin/python -m pytest -q`

## Progress
- Created 2026-11-14. Baseline: 6 passed, 1 skipped.
- T1 done: ad293f8 (schema, deps, settings).
- T2-T5 done in the follow-up commit (chunking, indexing use case, Voyage/Postgres adapters, `atlas-index`, `POST /search`, tests, README).
- Model `voyage-4`, output_dimension 1024. Chunking: experiment overview, one chunk per test, search-source overview + publications, CSV rows in groups of 8 with header context (89 chunks).
- Live smoke (local pgvector via `docker run`, no compose plugin): run 1 `89 new, 0 unchanged, 0 removed`; run 2 `0 new, 89 unchanged, 0 removed`; `/search` top hit PSI-107 sources.json overview (0.726).
- Tests: 11 passed, 2 skipped without DB; 13 passed with ATLAS_TEST_DATABASE_URL.

## Next step
Done; ready for review/merge.
