import os

import pytest
from fastapi.testclient import TestClient

from atlas.main import create_app
from atlas.shared.config import Settings

DATABASE_URL = os.environ.get("ATLAS_TEST_DATABASE_URL")


def test_health_reports_database_unavailable_without_failing():
    app = create_app(Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none"))

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "unavailable"}


@pytest.mark.skipif(not DATABASE_URL, reason="set ATLAS_TEST_DATABASE_URL and run atlas-load first")
def test_experiments_are_served_from_postgres():
    with TestClient(create_app(Settings(database_url=DATABASE_URL))) as client:
        listed = client.get("/experiments").json()
        detail = client.get("/experiments/PSI-99")
        missing = client.get("/experiments/PSI-0")

    assert "PSI-99" in [e["id"] for e in listed]
    assert len(detail.json()["tests"]) == 9
    assert missing.status_code == 404
