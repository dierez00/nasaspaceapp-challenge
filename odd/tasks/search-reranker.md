# Search reranker

## Objective
Rerank vector-search candidates with a Voyage reranker inside the search use case, so both `POST /search` and in-process callers (the researcher agent) get better top-k results.

## Problem / why
`search_documents` orders only by cosine similarity. The README assigns "reranker y citas" to the search module; it is the missing piece. The researcher agent will import `search_documents` directly (same process), so reranking belongs in the application layer, not the HTTP layer.

## Scope
- `Reranker` port in the search domain; Voyage adapter in infrastructure.
- `search_documents` fetches N candidates (N > k), reranks, returns top k; falls back to vector order if the reranker is missing or fails.
- Optional `rerank` flag (default on when configured) on the use case and `POST /search`; response keeps existing fields and adds the rerank score.
- Settings for rerank model and candidate count.
- Tests with a fake reranker; README note.

## Out of scope
Agents, `POST /query` (owned by a teammate), changes to indexing.

## Constraints
- No real Voyage calls while `atlas-index` runs (shared 3 RPM free-tier limit); live check deferred.
- No writes to the local database.
- Backward compatible signature for in-process callers (new parameters optional).

## Decisions
- Reranker lives in the application use case (both HTTP and in-process callers benefit).
- TDD: no project/session config → ordinary functional checks. Runner: `.venv/bin/python -m pytest`.

## Tasks
- [x] T1 Port, Voyage adapter, settings, use-case integration with fallback.
- [x] T2 API flag + response field, wiring in `create_app`.
- [x] T3 Tests + README.
- [ ] T4 Live check against the real index (after `atlas-index` finishes).

## Acceptance criteria
- With a reranker, top-k follows reranker order; without one or on failure, vector order is returned and the request succeeds.
- Existing callers of `search_documents` keep working unchanged.
- `pytest` green without network.

## Checks
`.venv/bin/python -m pytest -q`

## Progress
- Created 2026-11-14. Baseline: 39 passed, 3 skipped.
- 2026-11-14: T1-T3 done in one work unit. `.venv/bin/python -m pytest -q`: 47 passed, 3 skipped. Model `rerank-2.5` (Voyage docs: recommended `rerank-2.5`/`rerank-2.5-lite`; SDK 0.6.0 `AsyncClient.rerank(query, documents, model, top_k)`). Pool default 30.

## Next step
T4 (live check) once `atlas-index` finishes.
