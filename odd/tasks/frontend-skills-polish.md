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
- [ ] T2 WebGL/lab performance (F5, F6, F18): pause hero on `visibilitychange`, lower sphere segments and dpr cap, handle `webglcontextlost`, pause lab clock/render when dashboard is off-screen, fix invalid/permanent `will-change`.
- [ ] T3 LoadingScreen robustness (F4 safe parts): no `three` import, progress via ref not state, timer cleanup, safety timeout so it always hides, `h1`→non-heading, `aria-busy`. Keep current duration.
- [ ] T4 Structural a11y + UX feedback (F7, F8, F9, F11, F12, F13, F16): `<button>` scroll indicator, single `h1`, skip link, `aria-live` chat log, friendly error messages, node `transform-box`, no `transition: all`, probe input validation + out-of-zone feedback, ScrollIndicator without per-scroll re-render.
- [ ] T5 Tests + cleanup (F19, F15, dead code): fix e2e selectors for two canvases and new headings, lazy-load markdown fallback, delete `SpaceBackdrop.tsx`.

## Acceptance criteria
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass after each task; `pnpm build` passes at the end.
- No visible design change with default motion settings, except added feedback messages and focus/skip-link affordances.
- With `prefers-reduced-motion: reduce`: no parallax/drift, native scroll, static 3D frame.

## Progress / Evidence
- Skills vendored: `c2f6561`.
- Baseline (before edits): lint, typecheck, test (31 passed) all green.
- T1 reduced motion: COMMIT_T1. lint/typecheck/test green (31 passed). Hero: gsap.matchMedia (opacity-only under reduce), Lenis not created under reduce (reacts to live changes), flame drift off, 3D renders one static frame, loading spinner/pulse `motion-reduce:animate-none`. New hook `useReducedMotion`.

## Next step
T2.
