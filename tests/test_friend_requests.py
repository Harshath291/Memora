import pytest
from fastapi.testclient import TestClient

from backend.server import app

client = TestClient(app)

def test_create_friend_request_requires_auth():
    resp = client.post("/api/friend-requests", json={"to_username": "alice"})
    assert resp.status_code == 401

def test_list_friend_requests_requires_auth():
    resp = client.get("/api/friend-requests")
    assert resp.status_code == 401

def test_accept_requires_auth():
    resp = client.post("/api/friend-requests/some-id/accept")
    assert resp.status_code == 401
