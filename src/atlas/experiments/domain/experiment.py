"""Data contract for one PSI investigation (data/experiments/PSI-<n>.json).

One record per investigation; each entry in `tests` is one point on the gap map.
"""

from collections import Counter
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

SCHEMA_VERSION = "1.1"

ValueStatus = Literal["reported", "derived", "assumed"]
GravityEnvironment = Literal["microgravity", "lunar", "martian", "partial", "normal"]
FlowDirection = Literal["concurrent", "opposed", "quiescent", "mixed"]
BurnOutcome = Literal["no_ignition", "no_sustained_burn", "partial_burn", "complete_burn"]
PointType = Literal["test", "limit"]
LimitType = Literal["radiative_extinction", "blowoff", "quenching", "minimum_oxygen"]
MaterialClass = Literal["polymer", "fabric", "composite", "metal", "liquid", "gas", "other"]

NonEmpty = Annotated[str, Field(min_length=1)]
NonNegative = Annotated[float, Field(ge=0)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class SourceRef(Contract):
    file: NonEmpty = Field(description="PSI file name or page section the value comes from")
    locator: NonEmpty = Field(description="Row, table, page or section inside that file")


class NormalGravityReference(Contract):
    outcome: BurnOutcome
    spread_rate_mm_s: NonNegative | None
    note: str | None


class ExperimentTest(Contract):
    test_id: NonEmpty
    point_type: PointType = Field(
        description="test = one run as reported; limit = flammability limit the authors derived from several runs"
    )
    limit_type: LimitType | None
    derived_from: list[str] = Field(description="Source run ids behind a limit; empty for a test")
    material: NonEmpty
    material_class: MaterialClass
    thickness_mm: Annotated[float, Field(gt=0)] | None
    o2_basis: Literal["ambient", "oxidizer_stream"] = Field(
        default="ambient", description="Whether O2 describes the atmosphere or the burner oxidizer stream"
    )
    o2_percent: Annotated[float, Field(ge=0, le=100)]
    o2_percent_range: tuple[float, float] | None
    o2_status: ValueStatus
    pressure_kpa: Annotated[float, Field(gt=0)]
    pressure_status: ValueStatus
    gravity_environment: GravityEnvironment
    gravity_g: Annotated[float, Field(ge=0, le=1.5)] = Field(
        description="Representative level; use 1e-6 for orbital microgravity"
    )
    flow_velocity_cm_s: NonNegative | None
    flow_direction: FlowDirection | None
    outcome: BurnOutcome = Field(
        description="no_sustained_burn = ignited but self-extinguished almost immediately"
    )
    burn_length_cm: NonNegative | None
    spread_rate_mm_s: NonNegative | None
    normal_gravity_reference: NormalGravityReference | None
    notes: str | None
    source: SourceRef
    confidence: Literal["high", "medium", "low"]
    needs_review: bool

    @model_validator(mode="before")
    @classmethod
    def label_legacy_inverse_oxygen(cls, value):
        # Old persisted JSON lacks the additive field. Use the exact cited table,
        # never free-text notes, until atlas-load refreshes those records.
        if isinstance(value, dict) and "o2_basis" not in value:
            source = value.get("source")
            if isinstance(source, dict) and source.get("file") == "PSI-159_Experimental table_CFI-G_Inverse Flames.csv":
                return {**value, "o2_basis": "oxidizer_stream"}
        return value

    @model_validator(mode="after")
    def assumed_values_need_review(self) -> "ExperimentTest":
        if "assumed" in (self.o2_status, self.pressure_status) and not self.needs_review:
            raise ValueError("assumed O2 or pressure requires needs_review = true")
        if (self.point_type == "limit") != (self.limit_type is not None):
            raise ValueError("limit_type is required for limits and must be null for tests")
        return self


class SourceFile(Contract):
    file: NonEmpty
    url: HttpUrl | None


class Review(Contract):
    status: Literal["draft", "reviewed"]
    extracted_by: NonEmpty
    reviewed_by: str | None


class Experiment(Contract):
    schema_version: Literal["1.1"]
    id: Annotated[str, Field(pattern=r"^PSI-\d+$")]
    title: NonEmpty
    acronym: str | None
    doi: str | None
    source_url: HttpUrl
    research_area: NonEmpty
    sub_research_area: str | None
    platform: NonEmpty
    start_date: date | None
    end_date: date | None
    principal_investigator: str | None
    summary: NonEmpty = Field(description="One or two sentences, plain language")
    tests: Annotated[list[ExperimentTest], Field(min_length=1, description="Test IDs must be unique within this investigation")]
    sources: Annotated[list[SourceFile], Field(min_length=1)]
    review: Review


    @field_validator("tests")
    @classmethod
    def unique_test_ids(cls, tests: list[ExperimentTest]) -> list[ExperimentTest]:
        duplicates = sorted(test_id for test_id, count in Counter(t.test_id for t in tests).items() if count > 1)
        if duplicates:
            raise ValueError(f"duplicate test_id within investigation: {', '.join(duplicates)}")
        return tests
