# Feature: evidence-brief-console

## Objective
Turn the Atlas from "a chatbot with a simple UI" into a research instrument that students, teachers and researchers can use at a glance. The cabin concept continues inside the dashboard. Copilot answers become professor-style evidence briefs, aligned end to end between the FastAPI backend and the front, and the simulator becomes comparative and explanatory.

## Problem / Why
User feedback (2026-11-15):
- The dashboard reads as a simple chatbot UI, and the simulator is too simple.
- Answers sound like an AI consulting tools, not like a professor.
- Evidence observed in the code:
  - `src/modules/copilot/infra/backend-query.ts` flattens backend `table` components into markdown bullets with raw keys (`o2_percent_promedio: 21.0304`) and labels them "Respuesta de respaldo".
  - The `gap_map` component renders a static "Tres gravedades" widget that ignores the data.
  - The verdict is buried. Internal process details leak into the answer ("el investigador solo hizo dos búsquedas").

## Decisions (user-approved)
- **Cabin console:** the dashboard is the cabin's instrument console. Chrome (canvas, top bar, frames) uses Cabin Night `#0A1324`. The modules are lit screens that stay light for legibility. The lab 3D viewport uses the octagonal cupola window. Switching views is a short camera-like move (~400 ms). Restraint: the concept lives in details, not constant effects.
- **Evidence brief:** each answer has four parts:
  1. Veredicto: one confident sentence stating what the data shows.
  2. Evidencia: a real, sortable table, plus the matching points highlighted on the main map.
  3. Hueco: the missing region drawn on the map, plus what is missing.
  4. Siguiente paso: actions such as simulating this scenario in the lab or proposing an experiment.
- **Audience lens:** Estudiante / Docente / Investigador. The same evidence, with a different emphasis:
  - Estudiante: concept explained plus a thinking question.
  - Docente: a class activity with hypothesis, variables and what to observe in the simulator.
  - Investigador: exact source rows, ranges, CSV export and a citation.
- **Tone:** professor-like certainty grounded in data. Lead with the conclusion, then the evidence, then the limit in one plain line. Never invent certainty beyond the data. Never expose agent internals (searches made, tools, retries).
- **Simulator:** the three gravities side by side for the same material and conditions. Qualitative indicators (shape, color, sustains or extinguishes). Physics annotations tied to the timeline (buoyancy vs. diffusion). The nearest real trials to the simulated point.
- **Backend:** modified so the response contract and tone match the front.

## Scope
- Front repo `/home/diego/Desktop/nasa`, branch `test/frontend-skills`.
- Backend worktree `/home/diego/Desktop/nasa-worktrees/backend`, new branch `test/evidence-brief` cut from local `backend` (`e61ba97`).
- Never push either repository.

## Constraints
- Grounding stays mandatory: every claim must be traceable to data or sources.
- `theme.md` (Flight deck) gets updated for the console chrome.
- Next.js 16.3: read `node_modules/next/dist/docs/` before using Next APIs.
- Keep the existing a11y/perf guarantees: reduced motion, single h1, single main, aria-live chat log, single WebGL loop.
- TDD: off for the front (no config); for the backend use the project's test runner, as recorded in the backend tasks.
- Conventional Commits, work-unit commits, no AI attribution. ~400 changed lines per task is advisory only.

## Tasks
- [x] X0 Map the backend: agents, prompts, `/query` SSE contract, ui components, tests, runner.
- [x] F1 Cabin console shell: dark chrome with lit screens, octagonal lab window, view-switch move, theme.md update.
- [x] B1 Backend evidence-brief contract and professor tone: brief component (verdict, evidence table, gap, next steps, audience sections), audience parameter, no internals leakage, tests.
- [x] F2 Front evidence brief: render the brief and real tables, highlight evidence and gap on the main map, next-step actions, audience selector, CSV export and citation; remove the "Respuesta de respaldo" flattening.
- [ ] F3 Comparative simulator: three gravities side by side, qualitative indicators, physics annotations, nearest real trials.
- [ ] Q1 End-to-end QA: restart the backend on the test branch, live queries, screenshots, e2e, docs.

## Acceptance criteria
- Asking "Sólidos > 30% O₂" yields:
  - A one-sentence verdict.
  - A real table, not key-dump bullets.
  - Map highlights and a drawn gap.
  - Actionable next steps.
  - No agent-internal text.
- Switching the audience changes the emphasis without re-querying, or with a single re-query if the backend requires it.
- Lint, typecheck, test and build are green in the front; the backend test suite is green.

## Progress / Evidence
- Base: `visual-redesign-flight-deck` complete (`1d5f757`).
- F1 done (`5f0abad`): dark console chrome (`--console-*` tokens, mission strip, bezeled lit-screen modules), octagonal `.cupola-octagon` lab window with lit bevel, ~420 ms interruptible view slide (reduced motion: 120 ms fade), dive resolves into the dark console, theme.md updated. Checks: lint, typecheck, 44 tests, build green; orbit verified; no hscroll at 1440/1366/390. Shots: scratchpad `f1-*.png`.
- B1 done on backend branch `test/evidence-brief` (never pushed): `12fe8e5` brief component and grounded gap, `58d1c18` professor tone without internals, `a8fd9a2` cache v2 key and validation, `bc2d611` docs, `a57f26c` and `6b053c0` fixes (gap from any empty query, grouped experiment ids, empty-region verdict, composer timeout 40 s).
  - Checks: backend pytest `208 passed, 3 skipped` (base 180/3); no ruff/mypy configured. Real CLI composer call (no `CLAUDE_CODE_OAUTH_TOKEN`, the CLI's own login): strict schema with `BriefComponent` accepted; total 27-54 s, composer 12-35 s (one run timed out at 30 s and fell back to rules, hence 40 s).
  - Contract: `brief` component (`verdict`, `evidence`, `gap`, `next_steps` max 3, `lenses` student/teacher/researcher) as first component; `brief_version: 1` in the `ui` event. Cache key now `v2|...`; untracked `data/query_cache.json` deleted.
  - Open: gap does not use the `coverage` module yet; `o2_percent_min` mirrors the analyst's filter (30.01 for "> 30"); the :8000 uvicorn must be restarted from this branch.

- F2 done (`3ccfc57`, `47d3c88`, `b67137e`): `EvidenceBrief`/`DataTable`/`Notice`/`Narrative`/`MapFocus` blocks, faithful translator (no markdown flattening, "Respuesta de respaldo" removed), `progress` event replaces agent telemetry (user-term steps), 120 s timeout, sortable table, audience lens (localStorage), CSV and APA-like citation, map highlight and gap overlay (`highlightExperiments`, `showGap`, `clearOverlays`), next steps (simulate/explore_map/proposal), demo briefs, starters per audience.
  - Checks: lint, typecheck, 71 tests, build green. Live (backend :8001 + front copy :3100): Q1 29 s, Q2 37-55 s; shots scratchpad `f2*-q1/q2-*.png` at 1440 and 390.
  - Open: the chip "Sólidos > 30% O₂" no longer exists (e2e in `tests/e2e/atlas.spec.ts:277` needs the new starters, Q1). Backend: rules-fallback verdicts can be weak ("1 registro"), and one Q2 gap said "gravedad normal" with `gravity: lunar`.

## Next step
F3 comparative simulator, then Q1 (fix e2e starters); restart the backend on `test/evidence-brief` before Q1.
