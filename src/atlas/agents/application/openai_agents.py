"""Azure OpenAI agents: same Agents protocol and return shapes as ClaudeAgents,
each call a Chat Completions loop against the configured deployments."""

from typing import Any

from psycopg_pool import AsyncConnectionPool

from atlas.agents.application import options
from atlas.agents.application.agents_common import DIRECT_SEARCH_K, structured_output, with_kind
from atlas.agents.domain.classification import Classification
from atlas.agents.domain.ui import UIPayload
from atlas.agents.infrastructure.analyst_spec import build_analyst_spec
from atlas.agents.infrastructure.experiment_source import load_from_postgres
from atlas.agents.infrastructure.openai_runner import ChatAgentRunner, run_chat_agent
from atlas.agents.infrastructure.researcher_spec import SearchFn, add_refs, build_researcher_spec
from atlas.experiments.domain.experiment import Experiment
from atlas.shared.config import Settings


class OpenAIAgents:
    def __init__(
        self,
        settings: Settings,
        pool: AsyncConnectionPool,
        search: SearchFn,
        client: Any,
        runner: ChatAgentRunner = run_chat_agent,
    ) -> None:
        self._settings = settings
        self._pool = pool
        self._search = search
        self._client = client
        self._run = runner

    async def classify(self, question: str) -> Classification:
        run = await self._call(
            "classifier",
            self._settings.classifier_model,
            question,
            max_turns=1,
            response_schema=("Classification", Classification.model_json_schema()),
        )
        return Classification.model_validate(structured_output(run.structured, run.text))

    async def analyst(self, question: str, classification: Classification) -> dict[str, Any]:
        queries: list[dict[str, Any]] = []
        spec = build_analyst_spec(self._load_experiments, queries)
        run = await self._call(
            "analyst",
            self._settings.agent_model,
            with_kind(question, classification),
            max_turns=options.ANALYST_MAX_TURNS,
            tools=[spec],
        )
        return {"respuesta": run.text, "consultas": queries}

    async def _load_experiments(self) -> list[Experiment]:
        return await load_from_postgres(self._pool)

    async def researcher(self, question: str, classification: Classification) -> dict[str, Any]:
        sources: list[dict[str, Any]] = []
        if self._settings.investigador_mode == "direct":
            add_refs(sources, await self._search(question, DIRECT_SEARCH_K))
            return {"respuesta": None, "fuentes": sources}
        spec = build_researcher_spec(self._search, sources)
        run = await self._call(
            "researcher",
            self._settings.agent_model,
            with_kind(question, classification),
            max_turns=options.RESEARCHER_MAX_TURNS,
            tools=[spec],
        )
        return {"respuesta": run.text, "fuentes": sources}

    async def composer(self, prompt: str) -> Any:
        run = await self._call(
            "composer",
            self._settings.agent_model,
            prompt,
            max_turns=options.COMPOSER_MAX_TURNS,
            response_schema=("UIPayload", UIPayload.model_json_schema()),
        )
        return structured_output(run.structured, run.text)

    async def _call(self, prompt_name: str, model: str, prompt: str, **kwargs: Any):
        schema = kwargs.pop("response_schema", None)
        return await self._run(
            self._client,
            model=model,
            system_prompt=options.load_prompt(prompt_name),
            prompt=prompt,
            reasoning_effort=self._settings.azure_openai_reasoning_effort,
            response_schema=(schema[0], options._strict_schema(schema[1])) if schema else None,
            **kwargs,
        )
