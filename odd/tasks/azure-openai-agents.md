# Azure OpenAI agents

Let the `/query` agents (classifier, analyst, researcher, composer) run on a GPT model deployed in Azure OpenAI, selectable by configuration, while the existing Claude path keeps working unchanged.

## Why
The cloud environment provides an Azure OpenAI API key for a GPT deployment. The agents currently depend on `claude-agent-sdk`, which only talks to Claude endpoints, so that key cannot be used as-is.

## Scope and authorization
- User asked (2026-11-15): "hazlo compatible para gpt".
- Branch `feat/azure-openai-agents` from `origin/backend` (`eaf0131`), worktree `~/Desktop/nasa-worktrees/azure-openai-agents`.
- Work-unit commits on the feature branch only. Push, PR and merge remain the user's decisions.
- No real provider calls, no credential inspection, no live database changes. Tests use fakes only.
- Keep the domain, orchestrator (`run_query.py`), prompts, grounding and UI contract unchanged; the provider is an infrastructure concern.

## Design
- New setting `LLM_PROVIDER`: `claude` (default, current behavior) or `azure_openai`.
- Azure settings: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` (secret), `AZURE_OPENAI_API_VERSION`, optional `AZURE_OPENAI_REASONING_EFFORT`. `CLASSIFIER_MODEL` / `AGENT_MODEL` hold the Azure deployment names when the provider is `azure_openai`.
- Client: `openai.AsyncAzureOpenAI(azure_endpoint, api_key, api_version)`; `model=<deployment>` (source: openai-python README and `src/openai/lib/azure.py`).
- Tools are defined once as provider-neutral specs (name, description, JSON schema, async handler returning text + error flag); thin adapters expose them as Claude in-process MCP tools or as OpenAI function tools.
- OpenAI agents: Chat Completions tool-calling loop bounded by the same max-turn limits; structured outputs (classifier, composer) via `response_format` `json_schema` (non-strict; Pydantic still validates).

## Execution
- Route: delegated direct, one sequential writer; no SDD.
- TDD: off (same as previous backend features); ordinary functional checks required.
- Runner: `../backend/.venv/bin/python` with the isolated pytest invocation from `odd/tasks/backend-audit-fixes.md`, plus the `openai` package installed into that venv.
- Receipt-driven development: off (global, observed 2026-11-15).
- Delivery strategy: `ask-on-risk`. Forecast: ~450–600 authored changed lines; above the ~400 budget, so ask the chain strategy before opening any PR.

## Tasks
- [x] T1 Extract provider-neutral tool specs for `consultar_ensayos` and `buscar_documentos`; Claude MCP servers built from them with identical behavior. Existing tests green.
- [x] T2 Add settings, Azure OpenAI runner with tool loop and structured output, `OpenAIAgents` implementing the `Agents` protocol, provider selection in `main.py`, `openai` dependency, and offline tests with a fake client (tool call round trip, max turns, structured output, tool errors, config validation).
- [x] T3 Document the new variables in `.env.example`, `curren_repo_context/env.md`, `docs/deploy.md` and `README.md`.

## Acceptance
- `LLM_PROVIDER=claude` behaves exactly as before; full suite green.
- `LLM_PROVIDER=azure_openai` builds agents without importing a Claude credential, fails fast with a clear error if endpoint/key/version are missing, and the fake-client tests prove the loop, tool logging (`consultas`, `fuentes`) and structured outputs.
- No secrets in code, tests, docs or commits.

## Progress and evidence
- Exploration done: agents layer is `application/{claude_agents,options}.py` + `infrastructure/{claude_runner,analyst_tools,researcher_tools}.py`; wiring in `main.py::_configure_query`.

- Baseline (isolated suite): 213 passed, 3 database skips. T1 `0ee7a46`: 217 passed, 3 skipped; 351 authored lines (238 added + 113 test). Existing tests untouched and green.
- T2 `31d5179`: 236 passed, 3 skipped; 575 authored lines (541 added + 34 removed, ~290 of them tests). `AgentRunError`/`AgentRun` moved to `infrastructure/agent_run.py` (old import from `claude_runner` still works); `structured_output`/`with_kind` moved to `application/agents_common.py`.
- T3: documentation only (`.env.example`, `curren_repo_context/env.md`, `docs/deploy.md`, `README.md`); suite unchanged at 236 passed, 3 skipped; `git diff --check` clean for every commit.
- Decisions: `AZURE_OPENAI_API_VERSION` is required (no default, not verifiable offline); startup also refuses Claude-looking `CLASSIFIER_MODEL`/`AGENT_MODEL`. Query cache key deliberately unchanged (shipped demo cache is keyed `v2|question` and a test pins that); the docs tell to clear it when switching providers.
- Open risks: `reasoning_effort` is rejected by non-reasoning deployments (sent only when set); `response_format` json_schema needs an `api_version` that supports it; no live Azure call was made.

## Next step
Read-only review of the three commits, then the user decides push, PR and chain strategy (forecast exceeded: ~890 authored lines in total, mostly tests).
