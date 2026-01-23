import pytest
from fastapi.testclient import TestClient

from backend.server import app

client = TestClient(app)

def test_remove_friend_requires_auth():
    resp = client.delete("/api/friends/someuser")
    assert resp.status_code == 401
