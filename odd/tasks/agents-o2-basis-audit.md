# Agents: o2_basis support and audit

## Objective
Make the `/query` agents aware of the contract field `o2_basis` (ambient vs oxidizer_stream) and audit the agents pipeline for correctness, grounding, safety and robustness.

## Problem / why
Commit 9998638 split atmospheric O2 from burner oxidizer-stream O2 (`o2_basis`, PSI-159 inverse flames). The analyst tool `consultar_ensayos` (`agents/domain/ensayos.py`) and `prompts/analyst.md` still treat `o2_percent` as one quantity, so O2 range filters and groupings mix atmospheres with burner streams and can produce wrong answers about habitat atmospheres. The team asked to be told about contract changes because the analyst prompt lists fields by hand.

## Scope
- Analyst tool: expose `o2_basis` in rows, filter by it, allow grouping by it; sensible default behaviour for atmosphere questions.
- Prompts (analyst, and any other prompt/composer rule that reads O2): explain `o2_basis` and when to restrict to `ambient`.
- Mock agents and UI rules if they read O2.
- Audit of `src/atlas/agents/` and `src/atlas/query/`: findings with severity, file:line and failure scenario.
- Fix only confirmed, in-scope correctness/grounding defects; report the rest for the owner.

## Out of scope
Changing agent architecture, models, timeouts or the UI contract; frontend.

## Constraints
- Code owned by teammate (kentavazquez); keep style and Spanish prompt language; minimal, focused changes.
- Tests must not call Claude, Voyage or Postgres.

## Decisions
- TDD: no project/session config → ordinary functional checks. Runner: `.venv/bin/python -m pytest`.

## Tasks
- [x] T1 `o2_basis` in analyst tool (rows, filter, grouping) + tests.
- [x] T2 Prompts, mock agents and UI rules updated for `o2_basis` + tests.
- [ ] T3 Audit report of agents/query; fix confirmed in-scope defects with tests.

## Acceptance criteria
- An ambient-only O2 range query excludes oxidizer-stream points; grouping by `o2_basis` works.
- Analyst prompt documents `o2_basis` accurately.
- Audit findings listed with severity and evidence; `pytest` green.

## Checks
`.venv/bin/python -m pytest -q`

## Progress
- Created 2026-11-15. Baseline: 153 passed, 3 skipped.

## Next step
T1.
