# Coverage and gap map endpoint

## Objective
Serve `GET /coverage`: how the captured PSI points cover the O2 / pressure / gravity space, and which mission-relevant conditions (lunar habitat, suit, cabin) have no or weak experimental coverage.

## Problem / why
All PSI captures are in Postgres (13 experiments, `experiment_tests`). The gap map is the central deliverable of the Lunar Fire Atlas; the frontend team needs a stable JSON to draw it. Backend only; no UI work here.

## Scope
- Pure domain logic (no DB) that bins points and evaluates reference conditions.
- Reference conditions in a versioned data file with a cited source for every value (no values from memory).
- Postgres read adapter over `experiment_tests` and `GET /coverage` in a new `coverage` module.
- Tests with in-memory points; README section.

## Out of scope
Frontend, agents, RAG answers, changes to the experiment contract.

## Constraints
- Clean Architecture as in `src/atlas/experiments/` and `src/atlas/search/`.
- Distinguish `point_type` (test vs limit), carry `needs_review` and assumed vs measured O2/pressure so the UI can flag weak evidence.
- Do not run DB tests against the local DB while `atlas-index` runs (a search test deletes `document_chunks`).

## Decisions
- TDD: no project/session config → ordinary functional checks. Runner: `.venv/bin/python -m pytest`.

## Tasks
- [x] T1 Reference conditions data file with sources (Moon/Mars gravity, exploration atmosphere, ISS cabin, suit) + loader/validation.
- [x] T2 Domain: coverage model, binning by gravity regime and O2×pressure cells, outcome counts, gap evaluation per reference condition.
- [x] T3 Infrastructure + API: Postgres point reader, `GET /coverage`, wiring in `main.py`.
- [x] T4 Tests + README section.

## Acceptance criteria
- `GET /coverage` returns cells with counts by outcome and point type, per gravity regime.
- Every reference condition reports nearby evidence (count, experiments) or is flagged as a gap, and cites its source.
- `pytest` green without DB.

## Checks
`.venv/bin/python -m pytest -q`

## Progress
- Created 2026-11-14. Baseline: 11 passed, 2 skipped.
- T1-T4 done in one work unit (module, data file, tests and README are interdependent). Final: 28 passed, 2 skipped. Commit: feat(coverage) commit at branch tip (hash not embeddable in its own commit)
- Real data (read-only SELECT): 1082 points, all microgravity; lunar/Mars habitat conditions are gaps (no_matching_gravity), lunar suit is no_points.

## Next step
Review and merge.
