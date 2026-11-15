"""Mission-relevant conditions the gap map is evaluated against (data/reference/conditions.json)."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from atlas.experiments.domain.experiment import GravityEnvironment

NonEmpty = Annotated[str, Field(min_length=1)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Source(Contract):
    title: NonEmpty
    publisher: NonEmpty
    url: HttpUrl | None = Field(description="Null only for project conventions that have no public document")
    locator: NonEmpty = Field(description="Table, section or sentence the value comes from")


class ReferenceCondition(Contract):
    id: Annotated[str, Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")]
    name: NonEmpty
    description: NonEmpty
    gravity_environment: GravityEnvironment
    gravity_g: Annotated[float, Field(ge=0, le=1.5)] = Field(description="Ratio to Earth gravity")
    gravity_sources: Annotated[list[Source], Field(min_length=1)]
    o2_percent: Annotated[float, Field(ge=0, le=100)]
    pressure_kpa: Annotated[float, Field(gt=0)]
    atmosphere_sources: Annotated[list[Source], Field(min_length=1)]


class ReferenceConditions(Contract):
    schema_version: str
    description: NonEmpty
    conditions: Annotated[list[ReferenceCondition], Field(min_length=1)]
