import json
from pathlib import Path

from atlas.coverage.domain.reference import ReferenceCondition, ReferenceConditions


def load_reference_conditions(path: Path) -> list[ReferenceCondition]:
    """Raises pydantic.ValidationError when the file does not match the contract or repeats an id."""
    document = ReferenceConditions.model_validate(json.loads(path.read_text(encoding="utf-8")))
    ids = [c.id for c in document.conditions]
    if len(ids) != len(set(ids)):
        raise ValueError("reference condition ids must be unique")
    return document.conditions
