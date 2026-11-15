from dataclasses import dataclass, field
from typing import Any, Literal

from atlas.agents.domain.ui import BRIEF_VERSION

EventName = Literal["status", "ui", "error"]

# Values of status.step, in the order they can appear.
STEP_CACHE = "cache"
STEP_CLASSIFYING = "clasificando"
STEP_ANALYST = "consultando_datos"
STEP_RESEARCHER = "buscando_fuentes"
STEP_COMPOSER = "componiendo"


@dataclass(frozen=True)
class Event:
    name: EventName
    data: dict[str, Any]
    # Internal: true only for a `ui` event the file cache may store. Never sent to the front.
    cacheable: bool = field(default=False, compare=False)


def status(step: str) -> Event:
    return Event("status", {"step": step})


def with_brief_version(data: dict[str, Any]) -> dict[str, Any]:
    """Adds `brief_version` to a `ui` payload that carries a `brief` component, so the front can detect it."""
    if any(isinstance(c, dict) and c.get("type") == "brief" for c in data.get("components", [])):
        return {**data, "brief_version": BRIEF_VERSION}
    return data
