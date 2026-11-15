# Feature: visual-redesign-flight-deck

## Objective
Give the Atlas del Fuego Lunar a distinctive, legible, judge-impressing visual identity: a cupola "cabin" entry with a click-to-start immersion transition into a redesigned "flight deck" dashboard.

## Problem / Why
User feedback (2026-11-15): fonts too small, the UI looks "square" and AI-generated, elements inside the panel are hard to tell apart, and scrolling from the hero straight into the panel feels wrong. The current dashboard matches a common AI default (hairline rules, zero radius, dense columns, tracked uppercase micro-labels like "VOL. 001", "EXPLORAR / COMPRENDER"). The user explicitly allows replacing `theme.md`.

## Design direction: "Flight deck"
Story: you sit in the ISS cupola, press *Comenzar inmersión*, travel through the window toward the Moon and land in the instrument console.

- **Color tokens**
  - Cabin Night `#0A1324`: hero/cabin background, deep navy (not black).
  - Moon Dust `#E9EDF3`: dashboard canvas.
  - Instrument White `#FFFFFF`: module surfaces.
  - Ink `#0E1726`: primary text.
  - Slate `#4A5568`: secondary text (≥7:1 on white).
  - NASA Blue `#0B3D91`: structure, primary actions, selection.
  - Flame Orange `#FF5A1F`: ignition and the lunar operating zone (≥30 % O₂, ≤10.2 psi).
  - Blue Flame `#3B82F6`: microgravity, because real µg flames are blue.
  - Safe Emerald `#059669`: self-extinction.
  - Hairlines only as subtle module borders (`rgba(14,23,38,0.08)`).
- **Type**
  - Display: *Unbounded* (wide, spatial), used with restraint for the hero title and section titles only.
  - Body: *Instrument Sans*.
  - Data/numbers: *IBM Plex Mono* with tabular numerals.
  - Load all three via `next/font/google`.
  - Base 16 px, functional minimum 13 px, a clear modular scale.
  - Sentence case; drop decorative uppercase tracking except for at most one label style.
- **Shape and space**
  - Modules: 20 px radius, 12 px for inner elements, soft layered shadow plus a 1 px subtle border on Moon Dust.
  - Generous padding (20–24 px). Controls grouped into labeled instrument clusters.
  - Pill segmented controls and buttons, minimum 40 px height.
  - Visible focus ring in NASA Blue.
- **Copy**
  - Plain and user-side, in Spanish; remove ornamental eyebrows and fake metadata.
  - Primary CTA: "Comenzar inmersión". Actions keep the same name throughout the flow.
- **Signature: cupola immersion**
  - The hero is the cabin (existing `CupolaFrame` + 3D Moon/Earth). Page scroll is locked on the cabin; the only way in is the CTA, with the skip link and keyboard still working.
  - On press, in about 2.0–2.4 s, skippable with click or Esc:
    1. The cupola frame scales past the camera.
    2. The Moon dollies in.
    3. A brief light bloom through the window resolves into the dashboard.
  - Under reduced motion: a 300 ms crossfade.
  - A small "Volver a la cabina" control on the dashboard returns to the cabin.
  - Hero/loading cyan is replaced by the new palette.

## Scope
- In: `theme.md` rewrite, global tokens and fonts, dashboard restyle (header, lab, map, copilot, generative blocks), cabin hero + immersion flow, loading screen palette, e2e updates, visual QA at 1440×900, 1366×768 and 390×844.
- Out: backend, data contracts, simulation physics, new features beyond the immersion flow.

## Constraints
- Next.js 16.3: read `node_modules/next/dist/docs/` before using Next APIs (`next/font`, `next/dynamic`).
- Keep the a11y/perf work from `frontend-skills-polish`: reduced motion, single h1, single main, skip link, aria-live chat, WebGL pausing.
- TDD: off (no project/session config). Runner: `pnpm test` (Vitest); `pnpm test:e2e` needs a Chromium config locally (msedge not installed).
- Conventional Commits, work-unit commits per task, no AI attribution. Branch `test/frontend-skills`, never push.
- ~400 changed lines per task is advisory only.

## Tasks
- [x] D1 Design foundation: rewrite `theme.md` to the flight-deck system; tokens in `globals.css`; fonts via `next/font` in `layout.tsx`; remove the global dark `color-scheme` leak.
- [x] D2 Dashboard restyle, part 1: header/top bar, layout grid, lab module and controls (`atlas-app.tsx`, `atlas.css`, `laboratory.tsx`, `laboratory.css`).
- [x] D3 Dashboard restyle, part 2: evidence map, copilot panel and generative blocks (`atlas-map.tsx`, `atlas.css`, `copilot-panel.tsx`, `blocks.tsx`).
- [ ] D4 Cabin hero + immersion transition + "Volver a la cabina"; loading screen palette (`HeroSection.tsx`, `CupolaFrame.tsx`, `ScrollIndicator.tsx`, `page.tsx`, `SmoothScrollProvider.tsx`, `LoadingScreen.tsx`).
- [ ] D5 Visual QA and tests: screenshots at the three viewports, fix issues, update e2e and unit tests.

## Acceptance criteria
- `pnpm lint`, `pnpm typecheck`, `pnpm test` green after each task; `pnpm build` green at the end.
- No functional text below 13 px. Modules visually distinct from the canvas. No zero-radius hairline grid look.
- The cabin does not scroll into the dashboard. The CTA triggers the immersion, which can be skipped. Reduced motion gives a crossfade.
- Works at 390 px wide without horizontal scroll.

## Progress / Evidence
- Base: `frontend-skills-polish` complete (`19d84b7`).
- D1 done in `6abddf2`: theme.md rewritten, tokens + `@theme inline` in globals.css, Unbounded/Instrument Sans/Plex Mono via next/font, light color-scheme (`.theme-cabin` utility available for D4). lint/typecheck/test: green.
- D2 done in `6193306`: topbar with pill view tabs, Moon Dust canvas + 20px modules, lab clusters/segmented controls/slider styling, sentence-case copy, ornaments removed; lab CSS split (laboratory.css owns lab rules). lint/typecheck/test green; visual QA at 1440x900, 1366x768, 390x844 (no horizontal scroll).
- D3 done in `44cafb4`: map (Flame Orange lunar zone, Blue Flame microgravity, 12.5-13px axes, legend), copilot bubbles/pill composer/chips, generative blocks as inner modules (new atlas-map.css, copilot.css). lint/typecheck/test/build green. e2e not run locally (msedge missing); e2e text updated: 'Escenario hipotético'.

## Next step
D4 (hero + immersion). Note for D4: topbar has a spare slot next to the demo chip for 'Volver a la cabina'; `.theme-cabin` utility exists for dark scoping; mobile topbar is a 2-row grid (chip is grid-column 2/row 1).
