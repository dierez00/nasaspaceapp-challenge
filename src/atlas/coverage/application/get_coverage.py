from atlas.coverage.domain.coverage import CoverageMap, build_coverage_map
from atlas.coverage.domain.ports import CoveragePointReader
from atlas.coverage.domain.reference import ReferenceCondition


async def get_coverage(
    reader: CoveragePointReader, conditions: list[ReferenceCondition], material_class: str | None = None
) -> CoverageMap:
    return build_coverage_map(await reader.list_points(material_class), conditions)
