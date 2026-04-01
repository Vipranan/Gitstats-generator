import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app

client = TestClient(app)


@pytest.mark.parametrize("bad_input", [
    "nodash",
    "//repo",
    "owner/",
    "/repo",
    "owner//repo",
    "own er/repo",
    "owner/repo/extra",
])
def test_load_repo_rejects_invalid_format(bad_input):
    resp = client.post("/repo/load", json={"repo": bad_input})
    assert resp.status_code == 400, f"Expected 400 for '{bad_input}', got {resp.status_code}"
    assert "Invalid" in resp.json()["detail"]


@patch('app.routes.repo_routes.threading.Thread')
def test_load_repo_accepts_valid_format(_mock_thread):
    resp = client.post("/repo/load", json={"repo": "owner/repo"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "loading"
