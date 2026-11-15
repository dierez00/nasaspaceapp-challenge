"""UI contract sent to the front in the SSE `ui` event (draft until the H2 freeze).

The composer agent must return exactly this shape (its output_format is
UIPayload.model_json_schema()); the rules composer builds the same shape.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from atlas.experiments.domain.experiment import GravityEnvironment

Cell = str | float | int | bool | None
NonEmpty = Annotated[str, Field(min_length=1)]


class Component(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class TextComponent(Component):
    type: Literal["text"]
    body: NonEmpty = Field(description="Plain text answer in Spanish, a few sentences")


class TableComponent(Component):
    type: Literal["table"]
    title: NonEmpty
    columns: Annotated[list[str], Field(min_length=1)]
    rows: list[list[Cell]] = Field(description="Each row has one cell per column")


class GapMapComponent(Component):
    type: Literal["gap_map"]
    title: NonEmpty
    experiment_ids: list[Annotated[str, Field(pattern=r"^PSI-\d+$")]] = Field(
        description="Experiments to highlight on the map; empty means show all"
    )
    gravity_environment: GravityEnvironment | None = Field(description="Filter the map to one gravity level")
    note: str | None = Field(description="What the gap is, in one sentence")


class Citation(Component):
    experiment_id: Annotated[str, Field(pattern=r"^PSI-\d+$")]
    source_file: NonEmpty
    section: str | None
    quote: Annotated[str, Field(min_length=1, max_length=600)] = Field(description="Verbatim text from the document")


class CitationsComponent(Component):
    type: Literal["citations"]
    items: Annotated[list[Citation], Field(min_length=1)]


class NoticeComponent(Component):
    type: Literal["notice"]
    level: Literal["info", "warning"]
    message: NonEmpty


BriefGravity = Literal["microgravity", "lunar", "martian", "normal"]
BRIEF_VERSION = 1


class BriefEvidence(Component):
    title: NonEmpty
    columns: Annotated[list[str], Field(min_length=1)]
    rows: list[list[Cell]] = Field(description="Rows copied from a recorded query; one cell per column")
    experiment_ids: list[Annotated[str, Field(pattern=r"^PSI-\d+$")]] = Field(
        description="Experiments of these rows to highlight on the map"
    )


class BriefGap(Component):
    description: NonEmpty = Field(description="What is missing, in one plain sentence")
    pressure_kpa_min: float | None
    pressure_kpa_max: float | None
    o2_percent_min: float | None
    o2_percent_max: float | None
    gravity: BriefGravity | None


class BriefStep(Component):
    kind: Literal["simulate", "propose_experiment", "explore_map"]
    label: NonEmpty = Field(description="Short action label in Spanish")
    pressure_kpa: float | None
    o2_percent: float | None
    gravity: BriefGravity | None
    material: str | None


class BriefLenses(Component):
    student: NonEmpty = Field(description="Concept in plain language plus one thinking question")
    teacher: NonEmpty = Field(description="Short class activity: hypothesis, variables, what to observe")
    researcher: NonEmpty = Field(description="Rigor: ranges, assumptions, o2_basis, sources to check")


class BriefComponent(Component):
    """Evidence brief: verdict, evidence, gap, next steps and one text per audience."""

    type: Literal["brief"]
    verdict: NonEmpty = Field(description="One confident sentence of what the data shows")
    evidence: BriefEvidence | None
    gap: BriefGap | None
    next_steps: Annotated[list[BriefStep], Field(max_length=3)]
    lenses: BriefLenses


UIComponent = Annotated[
    TextComponent | TableComponent | GapMapComponent | CitationsComponent | NoticeComponent | BriefComponent,
    Field(discriminator="type"),
]


class UIPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: NonEmpty = Field(description="One or two sentences in Spanish answering the question")
    components: Annotated[list[UIComponent], Field(min_length=1, max_length=7)]
