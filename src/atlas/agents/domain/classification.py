"""Output of the classifier step: which kind of question it is and which agents it needs."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict

QueryKind = Literal["huecos", "comparar", "evidencia", "general"]


class Classification(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tipo: QueryKind
    necesita_datos: bool
    necesita_fuentes: bool


# Used when the classifier fails or times out: run both agents.
DEFAULT_CLASSIFICATION = Classification(tipo="general", necesita_datos=True, necesita_fuentes=True)

_KEYWORDS: list[tuple[QueryKind, re.Pattern[str]]] = [
    ("huecos", re.compile(r"\b(hueco|huecos|vac[ií]o|gap|gaps|sin probar|no probad|nadie ha)", re.I)),
    ("comparar", re.compile(r"\b(compar|versus|vs\.?|diferencia|mejor|peor)", re.I)),
    ("evidencia", re.compile(r"\b(evidencia|fuente|cita|informe|reporte|seg[uú]n|por qu[eé]|explica)", re.I)),
]


def classify_by_keywords(question: str) -> Classification:
    """Deterministic classifier for AGENTS_MOCK and tests; no LLM involved."""
    for kind, pattern in _KEYWORDS:
        if pattern.search(question):
            return Classification(
                tipo=kind,
                necesita_datos=kind != "evidencia",
                necesita_fuentes=kind != "huecos",
            )
    return DEFAULT_CLASSIFICATION
