# Feature: frontend-skills-polish

## Objective
Apply the vendored frontend skills (`.claude/skills/`) to the current UI on the test branch `test/frontend-skills`, implementing only fixes that do not change the approved visual design, so the user can review the result running locally.

## Problem / Why
A read-only audit (impeccable critique/audit/harden, web-design-guidelines, vercel-react-best-practices, r3f-best-practices, review-animations, animation-performance) found accessibility, performance and robustness gaps: no reduced-motion support in hero/loading, two WebGL contexts always rendering, per-frame React state updates, keyboard/ARIA gaps, a stale e2e suite.

## Scope
- In: audit findings F1, F4 (safe parts), F5, F6, F7, F8, F9, F11, F12, F13, F15, F16, F18, F19, dead `SpaceBackdrop.tsx`.
- Out (needs user decision): F2 global dark theme vs white canvas, F3 cyan palette, F10 font/touch sizes, F14 dark lab viewport, loading-screen duration cap. F17 asset resize. F20 rate limiting (backend).

## Constraints
- `theme.md` is the design system of record.
- Next.js 16.3: check `node_modules/next/dist/docs/` before using Next APIs.
- TDD: off (no project/session config found). Runner: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright). Ordinary functional checks apply.
- Conventional Commits, one or more work-unit commits per task, no AI attribution.
- Branch: `test/frontend-skills` (base `origin/main` + copilot timeout fix). Never push.

## Tasks
- [x] T1 Reduced motion in hero + loading (F1): `HeroSection.tsx`, `SmoothScrollProvider.tsx`, `MicrogravityFlame.tsx`, `SpaceBackdrop3D.tsx`, `LoadingScreen.tsx`.
- [x] T2 WebGL/lab performance (F5, F6, F18): pause hero on `visibilitychange`, lower sphere segments and dpr cap, handle `webglcontextlost`, pause lab clock/render when dashboard is off-screen, fix invalid/permanent `will-change`.
- [x] T3 LoadingScreen robustness (F4 safe parts): no `three` import, progress via ref not state, timer cleanup, safety timeout so it always hides, `h1`→non-heading, `aria-busy`. Keep current duration.
- [x] T4 Structural a11y + UX feedback (F7, F8, F9, F11, F12, F13, F16): `<button>` scroll indicator, single `h1`, skip link, `aria-live` chat log, friendly error messages, node `transform-box`, no `transition: all`, probe input validation + out-of-zone feedback, ScrollIndicator without per-scroll re-render.
- [x] T5 Tests + cleanup (F19, F15, dead code): fix e2e selectors for two canvases and new headings, lazy-load markdown fallback, delete `SpaceBackdrop.tsx`.

## Acceptance criteria
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass after each task; `pnpm build` passes at the end.
- No visible design change with default motion settings, except added feedback messages and focus/skip-link affordances.
- With `prefers-reduced-motion: reduce`: no parallax/drift, native scroll, static 3D frame.

## Progress / Evidence
- Skills vendored: `c2f6561`.
- Baseline (before edits): lint, typecheck, test (31 passed) all green.
- T1 reduced motion: `d1c632e`. lint/typecheck/test green (31 passed). Hero: gsap.matchMedia (opacity-only under reduce), Lenis not created under reduce (reacts to live changes), flame drift off, 3D renders one static frame, loading spinner/pulse `motion-reduce:animate-none`. New hook `useReducedMotion`.
- T2 WebGL/lab performance: `671cc6a`. lint/typecheck/test green (31 passed). Hero loop pauses on visibilitychange/off-screen/context loss, segments 64->32 (Earth) and 128->64 (Moon), dpr cap 1.5; lab `active` also requires dashboard in viewport (IntersectionObserver); invalid `will-change-opacity` removed, `will-change: transform` only during active hero scroll.
- T3 LoadingScreen robustness: `f8c7ae9`. lint/typecheck/test green (31 passed). No `three` import (progress via `atlas:hero-load-progress` window event from SpaceBackdrop3D's own LoadingManager), progress written through refs, all timers cleaned, 8 s JS safety timeout + 12 s CSS-only failsafe, `h1`->`p`, `aria-busy`/`aria-hidden`. Duration unchanged.
- T4 structural a11y + UX: `41eee6e`. lint/typecheck/test green (38 passed, +7 new in `tests/copilot-errors.test.ts`). ScrollIndicator is a real `<button>` driven by refs (no per-scroll setState), reduced-motion goes straight to the dashboard; single h1 (hero; atlas/lab headings now h2, CSS selectors updated); skip link `Saltar al Atlas`; hero logo aria-hidden; chat `role=log`; friendly Copilot errors (`CopilotError`, `describeCopilotError`, status mapping); `resolveProbe` clamps/validates and shows Spanish feedback (map click and manual form, form now `noValidate`); `transition: all` replaced; `.experiment-node` `transform-box: fill-box`.
- T5 tests + cleanup: `2a1d9d0`. lint/typecheck/test green (38 passed), `pnpm build` green. e2e selectors scoped to the lab canvas (`canvas[data-renderer="webgl"]`) and tests scroll `#dashboard` into view first (lab pauses off-screen); document-height assertion now checks `.atlas-app`; `react-markdown` lazy-loaded via `next/dynamic`; dead `SpaceBackdrop.tsx` deleted (no importers). Extra fix: hero backdrop no longer crashes the page when WebGL is unavailable (try/catch around renderer creation).
- e2e (local, Chromium 1208 from the Playwright cache because `msedge` is not installed; demo data via `ATLAS_DATA_MODE=demo` because `.env.local` selects remote): 10/11 pass; `immersive laboratory 1440x900` and `1366x768` fail only the FPS floor (8-22 fps under software GL, SwiftShader); the 390 px case passes (47-60 fps). The e2e suite needs a GPU-backed browser for those two assertions.

## Next step
Review locally (`pnpm dev`), then decide on out-of-scope items (F2, F3, F10, F14, duration cap, F17, F20). Not pushed.
