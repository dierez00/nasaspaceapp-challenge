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
- [x] F3 Comparative simulator: three gravities side by side, qualitative indicators, physics annotations, nearest real trials.
- [ ] O1 Observatory identity and continuity: shared orbital-combustion SVG emblem, uninterrupted dark cabin-to-panel transition, updated design tokens.
- [ ] O2 Instrument-first workspace: dominant map/lab, contextual collapsible copilot, progressive evidence, student exploration and researcher precision, responsive controls.
- [ ] O3 Flame presentation: richer qualitative volume, structure and restrained motion within the existing single rendering loop; accessible SVG/reduced-motion fallback.
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

- B2 done (backend `test/evidence-brief`, `39d7f61`): professor-style rules verdicts with recorded figures; gap description replaced when it names a gravity other than the computed one; raw enum tokens humanized in prose via `agents/domain/labels.py` (tables untouched); summary replaced when it duplicates the verdict. `.venv/bin/python -m pytest -q`: 213 passed, 3 skipped.

- F3 implementation verified, **uncommitted** (commit/delivery strategy pending): optional "Tres gravedades" mode derives µg / lunar / terrestrial views from the same A conditions and phase, using the existing single WebGL canvas/shared clock; independent A/B comparison remains available. The comparison uses the existing octagonal viewport and Cabin Night/light-instrument design.
  - Qualitative form/color and sustained/extinction readings explicitly describe the selected illustrative phase, never a computed combustion outcome. Three time segments explain diffusion/buoyancy and the unvalidated lunar illustration. Vacuum remains flame-free; reduced motion, SVG fallback, linked orbit/reset, and paused/hidden timing remain functional. Visual QA found stale scissor bounds after scrolling a paused mobile view; captured scroll/resize now invalidates the existing loop without adding another animation loop.
  - Nearest trials: same material and gravity, ranked by normalized pressure/O₂ distance; only verified rows with non-demo sources qualify. Exact source text, differences, unknown outcomes and load actions are separate from the illustration. Synthetic-only or missing evidence is explicitly empty, never manufactured.
  - TDD remains off (existing front configuration); verification uses package.json scripts. `pnpm lint`, `pnpm typecheck`, `pnpm test`: green (77 tests). `ATLAS_DATA_MODE=demo pnpm build`: green. `git diff --check`: green.
  - Local runtime: `ATLAS_DATA_MODE=demo node node_modules/next/dist/bin/next start --port 3101 --hostname 127.0.0.1`; no backend restart or live providers. Installed Chromium/SwiftShader used via ignored `test-results/f3.playwright.config.ts` because configured msedge is unavailable. `pnpm test:e2e --config test-results/f3.playwright.config.ts -g 'three gravities|three-gravity|explicit states|linked orbit|WebGL loss|no WebGL|clock suspends'`: **8 passed** (3 new F3, 5 existing regression scenarios).
  - Visual readback: `test-results/three-gravities-top-{1440,390}.png` and `test-results/three-gravities-{1440,390}.png`; no horizontal document overflow or unexpected page errors in new comparison scenarios. Full e2e suite, live real-trial/provider QA and physical-device performance remain Q1, not claimed complete. Narrow-screen screenshots also show the existing topbar mode pill can clip/shift horizontally after focus; document-level overflow checks pass but do not establish that every internal scroller fits.
  - Rollback boundary: `comparison.ts`, `comparison-notes.tsx`, laboratory/canvas/CSS extensions and their two test files; independent evidence brief/backend behavior is untouched. RDD is off; no native review started. No commits, pushes, PRs or merges created for F3 yet. 833 authored changed lines including this tracking entry; coherent behavior plus tests, not a line-budget acceptance claim.

## F3 completion (on top of `9c28134`)
- From `9c28134` (user): three-gravity views in the shared canvas (opt-in toggle), qualitative reading text, timeline explanation, nearest-trials list (verified, non-demo only), flame shader volume, collapsible assistant, dark entry.
- Added (`efcaaa5`, `11a825e`): pure `gravity-model.ts` (shape esférica/lágrima/alargada, transport difusión/mixto/flotación, color cue, relative brightness meter, threshold outlook from real trials within 0.12 normalized distance, else labeled "Sin ensayos: predicción ilustrativa" using O₂ partial pressure vs air), per-gravity indicator cards, one dismissible physics callout per timeline moment (ignición, crecimiento, régimen estable/extinción) placed under the playback bar, up to 3 nearest trials per gravity with "Ver en el mapa" (`highlightExperiments`) and material-family matching ("PMMA" matches "PMMA film (polímero)"), three-gravity mode and `focusGravity` lifted into simulation state, copilot `simulate` step now sets shared conditions, opens three-gravity view and emphasizes the named gravity.
- Decisions: three-gravity stays opt-in (user's e2e/design assume it); A/B kept as an alternative (mutually exclusive). `ComparisonNotes` lost its `threeGravities` prop (indicators/callout moved to `gravity-indicators.tsx`).
- Checks: lint, typecheck, 97 tests, build green. Draw calls/frame: 6 single, 12 three views (1440/1366/390), one WebGL canvas. Shots scratchpad `f3*-*.png`. Live simulate step verified against :8000 (focus badge on µg).
- Open for Q1: e2e not rerun (expects `physics-note` with "difusión" at 4 s and `.qualitative-grid` text, both preserved); catalog has no real lunar/earth PMMA trials so those columns show "Sin ensayos".

## Next step
Resolve F3 commit delivery strategy and commit the verified work unit, then Q1 (fix stale e2e starters and complete live end-to-end QA); restart the backend on `test/evidence-brief` only with authorization before live Q1.

## Approved observatory extension (2026-11-15)
- User approved the observatory proposal and requested improved central flame presentation/animation. This supersedes the earlier all-light instrument direction: dark scientific workspace; light surfaces reserved for reading evidence. Preserve existing F3, data, citations, initial stars/planet, audience lenses and A/B.
- Scope: frontend only; shared native SVG logo, remove white transition wash, lab/map first, contextual assistant, guided experiments and evidence access, qualitative flame refinement. No backend edits, live providers, remote operations, push or PR.
- TDD off (existing feature configuration); runners: pnpm lint, pnpm typecheck, pnpm test, ATLAS_DATA_MODE=demo pnpm build, local mocked Playwright using installed Chromium. Verify desktop/mobile, keyboard, reduced motion, WebGL fallback, evidence interactions and unchanged vacuum behavior.
- Forecast: 3 meaningful implementation work units, approximately 900–1500 authored lines plus tests; preserve clarity rather than shrink to a line budget. Existing F3 is 833 uncommitted lines. Delivery strategy remains ask-on-risk; do not commit until the outstanding size/chain decision is resolved. Source implementation is authorized.
- Next: O1 → O2 → O3, then independent checking. Do not claim live end-to-end backend QA from mock checks.

## Observatory implementation evidence (uncommitted)
- **O1 implemented:** one native orbital-combustion SVG (`AtlasMark`) shared by the cabin, loading surface and workspace, including a current-color monochrome variant. Entry is a 700 ms dark crossfade, return 350 ms, reduced motion 200 ms; no white veil/bloom or transformed fixed-canvas ancestor. Direct entry dismisses the cabin loader before paint; visual QA caught and removed its ghosted text over the instrument. Planet/stars remain the existing introductory backdrop. `theme.md` now records the approved observatory system and motion grammar in English.
- **O2 implemented:** laboratory/map occupy the workspace by default; contextual evidence/assistant is collapsed and persistently discoverable, with conversation retained when closed and keyboard focus returned to its trigger. Main instruments are dark; source/table reading surfaces remain pale. Student/teacher guidance changes one variable at a time; researcher perspective retains exact conditions, inclusive material/gravity/pressure/O₂ filters and CSV with provenance/source identifiers. Mobile topbar and internal scroll bounds pass at 390 px. Nearest-trial sources remain available even outside three-gravity mode. Stale F2 e2e starter/probe/next-action assertions were aligned with the actual evidence-brief contract. Demo citations now identify synthetic data rather than attributing it to NASA PSI.
- **O3 implemented:** blue cellular sphere, partial-gravity illustration and warm directional column now use shell/body emission, noise-driven texture, occlusion and gravity-dependent flow. Improved static SVG depth remains available. Existing single Canvas/shared clock, explicit selected phases, zero-pressure no-flame behavior, hidden/pause/reduced-motion and A/B/three-gravity behavior are preserved. No combustion solver, calibrated lunar interpolation, inferred outcome or safety threshold was introduced.
- **Final checks:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (**84 passed**) and `ATLAS_DATA_MODE=demo pnpm build` passed; `git diff --check` passed. Full `pnpm test:e2e --config test-results/observatory.playwright.config.ts`: **23 passed, 2 failed**. Both failures are the unchanged desktop 45 FPS assertions under installed Chromium/SwiftShader: 1440 single 6.0 FPS (comparison sample 9.9), 1366 single 6.4 FPS (comparison 11.9). Mobile single 45.1 / comparison 50.5 passed its 30 FPS budget. Functional assertions run before the FPS assertions and passed, including source tables/CSV/citation/map highlights/gap, guided exploration, keyboard close/focus, entry/return/skip/direct link, A/B orbit/reset, vacuum, reduced motion, SVG fallback and hidden-clock suspension. Do not report the full suite or hardware performance as green.
- **Shader cost investigation:** isolated local browser compilation substituted HEAD's previous fragment using `shaderSource` interception, without changing source files/worktrees. Same current layout, camera, renderer and step budgets: pre-optimization previous/new settled roughly 10.1/9.6 FPS single and 7.6/5.7 triple. Replaced expensive per-sample exponentials with smooth polynomial/linear artistic terms and restored prior 20/32 sample budgets. Repeat previous/new settled 10.1 versus 9.8–9.9 single and 7.5 versus 7.5–7.6 triple. This bounds shader-only cost, not the entire previous application's performance; real-GPU/device performance remains unverified. Exact samples: ignored `test-results/shader-comparison.json` and `.preopt.json`; reproducible local script `test-results/compare-shaders.mjs`.
- **Visual readback:** inspected actual WebGL single/triple captures (`flame-new-single.png`, `flame-new-triple.png`), desktop/mobile instrument/research views (`observatory-guided-*`, `observatory-research-*`) and pale evidence reader (`observatory-evidence.png`) under `test-results/`. Actual shared-clock motion was observed from **2.0 to 5.4 s** with one WebGL canvas; inspected `flame-motion-start.png` / `flame-motion-end.png` showing changing cellular contours and directional flow. Video capture unavailable because Playwright's required ffmpeg-1013 is not installed; no download attempted. Frame readback does not prove smooth real-device frame rate.
- **Runtime and remaining work:** own mock-only server `http://127.0.0.1:3102/#dashboard` (`ATLAS_DATA_MODE=demo node node_modules/next/dist/bin/next start --port 3102 --hostname 127.0.0.1`). Existing user servers, backend, credentials, live providers and remotes were not touched. RDD remains off. F3/O1/O2/O3 stay unchecked because commits are explicitly held pending the size/delivery decision; no commits, staging, pushes, PRs or merges. Q1 live backend/provider QA and real-device/GPU checks remain pending. Parent owns Engram mirror reconciliation.

### Scoped independent-check correction: evidence focus versus researcher filters
- Root cause: the map filtered rendered nodes by material/gravity/pressure/O₂ while the evidence banner counted matches against the unfiltered catalog, claiming invisible highlights. The banner now counts actual displayed trial rows, reports hidden matches (including partially visible investigations), and offers focused keyboard-accessible "Mostrar ensayos ocultos" instead of silently changing researcher inputs.
- Explicit reveal supplements the plotted points only. Existing filter values and CSV scope are preserved and explained; "Volver a mis filtros" restores the original plotted subset. The map count uses the actual displayed subset, filtered-export status names its own scope, and the empty-map notice is absent when revealed evidence is visible. The focus banner sits above the plot rather than covering the trials; the instrument scrolls normally when controls plus plot exceed its height.
- Regression: combined material Nomex, terrestrial gravity, zero maximum pressure and 40–45% O₂ yields 0/12 plotted points; a six-trial evidence request reports 0 highlighted / 6 hidden. Keyboard reveal displays all six and accurately reports 6/12, preserves all four filter dimensions and disabled zero-row filtered CSV, then restores 0/12 on return. Unit coverage also checks partially visible rows within one investigation.
- Checks on the corrected source: `pnpm lint`, `pnpm typecheck`, `pnpm test` (**85 passed**), `ATLAS_DATA_MODE=demo pnpm build`, and `git diff --check` passed. `pnpm test:e2e --config test-results/observatory.playwright.config.ts -g 'evidence focus reveals|contextual briefs retain|instrument leads'`: **4 passed** (desktop/mobile workspace, contextual evidence focus and mixed-filter reveal). Inspected `test-results/evidence-filter-reveal.png` after relocating the banner above the plot.
- The earlier full-suite **23 passed / 2 desktop FPS failures** remains the recorded performance limitation; expensive FPS tests were not rerun for this map-only fix. No live backend/provider checks, commits, staging, pushes or PRs. Own mock server remains at `http://127.0.0.1:3102/#dashboard`; parent owns the Engram mirror update.
