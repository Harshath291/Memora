import pytest
from fastapi.testclient import TestClient

from backend.server import app

client = TestClient(app)

def test_unread_counts_requires_auth():
    resp = client.get("/api/messages/unread_counts")
    assert resp.status_code == 401

def test_mark_read_requires_auth():
    resp = client.post("/api/messages/someuser/read")
    assert resp.status_code == 401
