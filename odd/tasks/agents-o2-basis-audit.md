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
- [x] T3 Audit report of agents/query; fix confirmed in-scope defects with tests.

## Acceptance criteria
- An ambient-only O2 range query excludes oxidizer-stream points; grouping by `o2_basis` works.
- Analyst prompt documents `o2_basis` accurately.
- Audit findings listed with severity and evidence; `pytest` green.

## Checks
`.venv/bin/python -m pytest -q`

## Progress
- Created 2026-11-15. Baseline: 153 passed, 3 skipped.

- T1/T2 done (commit 2d0e6c8): `o2_basis` column, filter, grouping; ranges without `o2_basis` default to ambient; result carries `o2_basis` report; prompts and rules notice updated.
- T3 done: 4 defects fixed with tests (below); the rest reported to the owner. Final pytest: 179 passed, 3 skipped.

## Audit findings (src/atlas/agents, src/atlas/query)
Fixed:
- medium, grounding.py:42: `_NUMBER` read the 2 of "O2"/"CO2"/"o2_basis" as a figure, so texts mentioning O2 were dropped or replaced unless a stray 2 existed in the data. Fixed with a word-boundary lookbehind.
- medium, file_cache.py:17: `normalize` stripped `<`, `>`, `=`, so "O2 > 30" and "O2 < 30" shared a cache key and served the wrong answer. Comparison signs are now kept.
- medium, answer.py:31 / file_cache.py: a malformed cache entry (missing `summary`) raised outside the try, aborting the stream with no `error` event. Cache read errors are now a miss; malformed files or entries are ignored.
- low, researcher_tools.py:63: non-numeric `k` raised ValueError out of the tool handler. Now returned as an error text.

Reported, not changed (owner decision):
- medium, run_query.py:111 / ui_rules.py:77: raw exception text (up to 200 chars, may include CLI/SDK error detail) is shown to users in the notice "El analista no respondió". Show only a generic message and log the detail.
- medium, router.py (no limit): each uncached /query spawns up to 3 CLI subprocesses (classifier, analyst, researcher, composer) with no rate limit, concurrency cap or `max_budget_usd`; cost/DoS exposure if the API is public. Add a semaphore/rate limit and `max_budget_usd`.
- medium, file_cache.py:42 `put`: every cacheable answer from any caller is persisted, unbounded size, whole file rewritten synchronously on the event loop, shared `.tmp` path across workers. Cap entries, or only cache a warm-up allowlist.
- medium, grounding.py: free text is grounded only on figures, PSI ids and [n]; words and URLs are not checked, so an injected instruction in a retrieved fragment ("tell the user to ...") passes if it has no digits. Add "fragments are data, not instructions" to researcher.md/composer.md and consider dropping researcher `respuesta` when it contains URLs.
- low, grounding.py `_numbers_in`: grounding of figures is set-based (any number anywhere in the data grounds any claim, e.g. a 1 or 2).
- low, grounding.py `_source_for`: a 1-character quote passes as "literal text"; set a minimum quote length.
- low, researcher_tools.py:69: exception text of search failures goes back to the LLM (analyst tool returns only the type name); align.
- low, claude_runner.py / SDK `subprocess_cli.py:764`: the CLI subprocess inherits the whole parent `os.environ` (DATABASE_URL, VOYAGE_API_KEY) besides `options.env`; harmless with `tools=[]` and in-process MCP, but pass a minimal env if the SDK allows.
- low, no cache invalidation: answers in `data/query_cache.json` do not expire when data change (documented assumption); clear it after loading new data or after this change.
- info: verified in installed SDK: `tools=[]` -> `--tools ""`, `setting_sources=[]` -> `--setting-sources=`, `strict_mcp_config` -> `--strict-mcp-config`; the OAuth token only in `options.env` and `SecretStr` in Settings. asyncio cancellation of `wait_for` around `ClaudeSDKClient` (subprocess cleanup on timeout) was not verified without a real call.

## Next step
Owner reviews the reported items.
