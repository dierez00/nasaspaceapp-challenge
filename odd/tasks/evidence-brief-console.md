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
- [ ] X0 Map the backend: agents, prompts, `/query` SSE contract, ui components, tests, runner.
- [ ] F1 Cabin console shell: dark chrome with lit screens, octagonal lab window, view-switch move, theme.md update.
- [ ] B1 Backend evidence-brief contract and professor tone: brief component (verdict, evidence table, gap, next steps, audience sections), audience parameter, no internals leakage, tests.
- [ ] F2 Front evidence brief: render the brief and real tables, highlight evidence and gap on the main map, next-step actions, audience selector, CSV export and citation; remove the "Respuesta de respaldo" flattening.
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

## Next step
X0 and F1 in parallel.
