from typing import Protocol

from atlas.coverage.domain.coverage import CoveragePoint


class CoveragePointReader(Protocol):
    async def list_points(self, material_class: str | None = None) -> list[CoveragePoint]: ...
