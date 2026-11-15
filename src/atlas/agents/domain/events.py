from dataclasses import dataclass, field
from typing import Any, Literal

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
