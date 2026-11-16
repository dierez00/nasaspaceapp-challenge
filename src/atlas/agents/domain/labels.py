"""Spanish and English labels for raw enum tokens that leak into prose.

Tables and columns keep the recorded raw values (grounding compares them with the queries);
only free text the user reads is humanized, through `humanize_ui`.
"""

import re

from atlas.agents.domain.lang import DEFAULT_LANG, Lang
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
ENUM_LABELS_EN: dict[str, str] = {
    "oxidizer_stream": "oxidizer stream",
    "partial_burn": "partial burn",
    "complete_burn": "complete burn",
    "no_sustained_burn": "no sustained burn",
    "no_ignition": "no ignition",
    "microgravity": "microgravity",
    "martian": "Martian",
    "ambient": "ambient",
    "radiative_extinction": "radiative extinction",
    "blowoff": "flame blowoff",
    "quenching": "flame quenching",
    "minimum_oxygen": "minimum oxygen",
    "concurrent": "concurrent flow",
    "opposed": "opposed flow",
    "quiescent": "quiescent",
    "needs_review": "pending review",
    "o2_basis": "O₂ basis",
    "o2_percent": "O₂",
    "pressure_kpa": "pressure",
    "gravity_environment": "gravity",
}
_LABELS: dict[Lang, dict[str, str]] = {"es": ENUM_LABELS, "en": ENUM_LABELS_EN}
_PATTERN = re.compile(
    r"(?<![\w-])(" + "|".join(sorted(map(re.escape, ENUM_LABELS), key=len, reverse=True)) + r")(?![\w-])",
    re.IGNORECASE,
)


def humanize(text: str | None, lang: Lang = DEFAULT_LANG) -> str | None:
    if not text:
        return text
    labels = _LABELS[lang]
    return _PATTERN.sub(lambda m: labels[m.group(1).lower()], text)


def humanize_ui(ui: UIPayload, lang: Lang = DEFAULT_LANG) -> UIPayload:
    """Humanizes prose fields only; tables, evidence and ids are returned untouched."""
    components = [_component(c, lang) for c in ui.components]
    return UIPayload(summary=humanize(ui.summary, lang) or ui.summary, components=components)


def _component(component, lang: Lang):
    if isinstance(component, TextComponent):
        return component.model_copy(update={"body": humanize(component.body, lang)})
    if isinstance(component, NoticeComponent):
        return component.model_copy(update={"message": humanize(component.message, lang)})
    if isinstance(component, GapMapComponent):
        return component.model_copy(update={"note": humanize(component.note, lang)})
    if isinstance(component, BriefComponent):
        gap = component.gap
        if gap is not None:
            gap = gap.model_copy(update={"description": humanize(gap.description, lang)})
        return component.model_copy(
            update={
                "verdict": humanize(component.verdict, lang),
                "gap": gap,
                "lenses": component.lenses.model_copy(
                    update={k: humanize(v, lang) for k, v in component.lenses.model_dump().items()}
                ),
                "next_steps": [s.model_copy(update={"label": humanize(s.label, lang)}) for s in component.next_steps],
            }
        )
    return component
