# Deploy readiness

## Objective
Prepare the repository for deployment (frontend on Vercel, FastAPI backend on Railway), remove the unused SaaS template layer, rewrite the READMEs and open a PR from `test/frontend-skills` to `main`.

## Why
The frontend was bootstrapped from a multi-tenant SaaS template (Supabase Auth, Prisma, tenants). Atlas uses none of it, but it still forces Supabase/Postgres env vars, a Prisma postinstall and a database CI job, which block a clean Vercel deploy and confuse readers.

## Scope
- Frontend (`test/frontend-skills` → `main`): template removal, Vercel config, env docs, CI, README.
- Backend (`backend` branch): Railway config and README.

## Constraints
- TDD: off (no project configuration enables it); ordinary checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- No secrets in docs; env examples use placeholders.
- Push (force-with-lease after the rebase) and PR creation are confirmed with the user.

## Tasks
- [x] T1 Rebase `test/frontend-skills` onto `origin/main` (41 commits; branch side kept on UI conflicts, main's surviving copy change re-applied in `859b467`).
- [x] T2 Remove the SaaS template layer (auth, tenants, admin, Supabase, Prisma, proxy, related deps, tests and CI job).
- [x] T3 Vercel readiness: env example, site identity, health route, CI.
- [x] T4 Rewrite `README.md` and `docs/` (architecture, technologies, deploy, link to `backend` branch).
- [x] T5 Backend branch: Railway config and README.
- [ ] T6 Push and open PR to `main` (user confirmation).

## Progress / evidence
- T1: `git rebase -X theirs origin/main` succeeded; tree equal to the pre-rebase branch; fixup commit `859b467`.

- T2: commit `2b9b20a`; `pnpm check` green (lint, typecheck, 88 Vitest tests, build with routes `/`, `/api/atlas/*`, `/api/health`).
- T3: commit `424bfd1` (site identity, `maxDuration = 150` on `/api/atlas/query`, env example). No `vercel.json` needed.
- T4: README rewritten (architecture, technologies, branches, Vercel/Railway deploy); stale template notes removed from `docs/`.
- T5: on `test/evidence-brief` (contains all of `origin/backend` plus the evidence-brief contract the frontend consumes): commit `fbafaea` adds `Dockerfile`, `.dockerignore`, `railway.json` and a Railway guide. Image built and smoke-tested locally (`PORT` honored, bundled Claude CLI present, `/health` and mock `/query` SSE OK). Real Railway deploy not executed.

## Next step
T6: user confirms force-push of `test/frontend-skills`, push of `test/evidence-brief`, and the PRs (`test/frontend-skills` → `main`, `test/evidence-brief` → `backend`).
