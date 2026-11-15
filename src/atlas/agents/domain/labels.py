"""Spanish labels for raw enum tokens that leak into prose.

Tables and columns keep the recorded raw values (grounding compares them with the queries);
only free text the user reads is humanized, through `humanize_ui`.
"""

import re

from atlas.agents.domain.ui import (
    BriefComponent,
    GapMapComponent,
    NoticeComponent,
    TextComponent,
    UIPayload,
)

ENUM_LABELS: dict[str, str] = {
    "oxidizer_stream": "corriente oxidante",
    "partial_burn": "combustión parcial",
    "complete_burn": "combustión completa",
    "no_sustained_burn": "sin combustión sostenida",
    "no_ignition": "sin ignición",
    "microgravity": "microgravedad",
    "martian": "marciana",
    "ambient": "ambiental",
    "radiative_extinction": "extinción radiativa",
    "blowoff": "soplado de la llama",
    "quenching": "enfriamiento de la llama",
    "minimum_oxygen": "oxígeno mínimo",
    "concurrent": "flujo concurrente",
    "opposed": "flujo opuesto",
    "quiescent": "sin flujo",
    "needs_review": "pendiente de revisión",
    "o2_basis": "base del O₂",
    "o2_percent": "O₂",
    "pressure_kpa": "presión",
    "gravity_environment": "gravedad",
}
_PATTERN = re.compile(
    r"(?<![\w-])(" + "|".join(sorted(map(re.escape, ENUM_LABELS), key=len, reverse=True)) + r")(?![\w-])",
    re.IGNORECASE,
)


def humanize(text: str | None) -> str | None:
    if not text:
        return text
    return _PATTERN.sub(lambda m: ENUM_LABELS[m.group(1).lower()], text)


def humanize_ui(ui: UIPayload) -> UIPayload:
    """Humanizes prose fields only; tables, evidence and ids are returned untouched."""
    components = [_component(c) for c in ui.components]
    return UIPayload(summary=humanize(ui.summary) or ui.summary, components=components)


def _component(component):
    if isinstance(component, TextComponent):
        return component.model_copy(update={"body": humanize(component.body)})
    if isinstance(component, NoticeComponent):
        return component.model_copy(update={"message": humanize(component.message)})
    if isinstance(component, GapMapComponent):
        return component.model_copy(update={"note": humanize(component.note)})
    if isinstance(component, BriefComponent):
        gap = component.gap
        if gap is not None:
            gap = gap.model_copy(update={"description": humanize(gap.description)})
        return component.model_copy(
            update={
                "verdict": humanize(component.verdict),
                "gap": gap,
                "lenses": component.lenses.model_copy(
                    update={k: humanize(v) for k, v in component.lenses.model_dump().items()}
                ),
                "next_steps": [s.model_copy(update={"label": humanize(s.label)}) for s in component.next_steps],
            }
        )
    return component
