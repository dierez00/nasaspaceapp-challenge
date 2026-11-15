from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from psycopg import AsyncConnection
from pydantic import ValidationError

from atlas.coverage.application.get_coverage import get_coverage
from atlas.coverage.application.load_reference_conditions import load_reference_conditions
from atlas.coverage.domain.coverage import CoverageMap
from atlas.coverage.domain.ports import CoveragePointReader
from atlas.coverage.domain.reference import ReferenceCondition
from atlas.coverage.infrastructure.postgres_point_reader import PostgresPointReader
from atlas.experiments.domain.experiment import MaterialClass
from atlas.shared.api import get_connection

router = APIRouter(prefix="/coverage", tags=["coverage"])


def get_reader(conn: Annotated[AsyncConnection, Depends(get_connection)]) -> CoveragePointReader:
    return PostgresPointReader(conn)


def get_conditions(request: Request) -> list[ReferenceCondition]:
    path = request.app.state.data_dir / "reference" / "conditions.json"
    try:
        return load_reference_conditions(path)
    except (OSError, ValueError, ValidationError) as error:
        raise HTTPException(status_code=500, detail=f"Reference conditions are unavailable: {error}") from error


@router.get("", response_model=CoverageMap)
async def coverage(
    reader: Annotated[CoveragePointReader, Depends(get_reader)],
    conditions: Annotated[list[ReferenceCondition], Depends(get_conditions)],
    material_class: Annotated[MaterialClass | None, Query()] = None,
) -> CoverageMap:
    return await get_coverage(reader, conditions, material_class)
