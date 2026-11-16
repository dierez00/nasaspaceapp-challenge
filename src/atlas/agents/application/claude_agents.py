"""Real agents: each call is an independent ClaudeSDKClient with its own options."""

from typing import Any

from psycopg_pool import AsyncConnectionPool

from atlas.agents.application import options
from atlas.agents.application.agents_common import DIRECT_SEARCH_K, structured_output, with_kind
from atlas.agents.domain.classification import Classification
from atlas.agents.domain.lang import without_note
from atlas.agents.infrastructure.analyst_tools import build_analyst_server
from atlas.agents.infrastructure.claude_runner import AgentRunner, run_agent
from atlas.agents.infrastructure.researcher_tools import SearchFn, add_refs, build_researcher_server
from atlas.agents.infrastructure.experiment_source import load_from_postgres
from atlas.experiments.domain.experiment import Experiment
from atlas.shared.config import Settings


class ClaudeAgents:
    def __init__(
        self,
        settings: Settings,
        pool: AsyncConnectionPool,
        search: SearchFn,
        runner: AgentRunner = run_agent,
    ) -> None:
        self._settings = settings
        self._pool = pool
        self._search = search
        self._run = runner

    async def classify(self, question: str) -> Classification:
        run = await self._run(options.classifier_options(self._settings), question)
        return Classification.model_validate(structured_output(run.structured, run.text))

    async def analyst(self, question: str, classification: Classification) -> dict[str, Any]:
        queries: list[dict[str, Any]] = []
        server = build_analyst_server(self._load_experiments, queries)
        run = await self._run(options.analyst_options(self._settings, server), with_kind(question, classification))
        return {"respuesta": run.text, "consultas": queries}

    async def _load_experiments(self) -> list[Experiment]:
        return await load_from_postgres(self._pool)

    async def researcher(self, question: str, classification: Classification) -> dict[str, Any]:
        if self._settings.investigador_mode == "direct":
            sources: list[dict[str, Any]] = []
            add_refs(sources, await self._search(without_note(question), DIRECT_SEARCH_K))
            return {"respuesta": None, "fuentes": sources}
        sources: list[dict[str, Any]] = []
        server = build_researcher_server(self._search, sources)
        run = await self._run(options.researcher_options(self._settings, server), with_kind(question, classification))
        return {"respuesta": run.text, "fuentes": sources}

    async def composer(self, prompt: str) -> Any:
        run = await self._run(options.composer_options(self._settings), prompt)
        return structured_output(run.structured, run.text)
