"""AGENTS_MOCK=1: deterministic agents built from data/experiments/*.json so the
front can integrate /query without spending tokens or needing Postgres."""

from functools import cached_property
from pathlib import Path
from typing import Any

from atlas.agents.domain.classification import Classification, classify_by_keywords
from atlas.agents.domain.ensayos import FiltroEnsayos, consultar
from atlas.agents.infrastructure.experiment_source import load_from_files
from atlas.experiments.domain.experiment import Experiment

_MAX_SOURCES = 3


class MockAgents:
    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir

    @cached_property
    def _experiments(self) -> list[Experiment]:
        return load_from_files(self._data_dir)

    async def classify(self, question: str) -> Classification:
        return classify_by_keywords(question)

    async def analyst(self, question: str, classification: Classification) -> dict[str, Any]:
        filtro = FiltroEnsayos(agrupar_por=["experiment_id", "gravity_environment", "outcome"])
        result = consultar(self._experiments, filtro)
        return {
            "respuesta": f"El Atlas registra {result['total']} grupos de ensayos.",
            "consultas": [{"filtros": filtro.model_dump(mode="json", exclude_defaults=True), **result}],
        }

    async def researcher(self, question: str, classification: Classification) -> dict[str, Any]:
        sources = [
            {
                "ref": index,
                "experiment_id": e.id,
                "source_file": e.sources[0].file,
                "section": "summary",
                "content": e.summary,
                "score": 1.0,
                "rerank_score": None,
            }
            for index, e in enumerate(self._experiments[:_MAX_SOURCES], start=1)
        ]
        return {"respuesta": "Los resúmenes de los experimentos describen estas condiciones.", "fuentes": sources}

    async def composer(self, prompt: str) -> Any:
        raise NotImplementedError("AGENTS_MOCK always uses the rules composer")
