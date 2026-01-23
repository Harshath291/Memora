import time
import pytest
from fastapi.testclient import TestClient

from backend.server import app, db

client = TestClient(app)


def create_user(username, password="pass123"):
    resp = client.post("/api/auth/signup", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    return data["token"], data["user_id"], data["username"]


def test_friend_request_flow():
    # create unique usernames
    ts = int(time.time())
    u1 = f"testuser_a_{ts}"
    u2 = f"testuser_b_{ts}"

    token1, id1, _ = create_user(u1)
    token2, id2, _ = create_user(u2)

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # send friend request from u1 -> u2
    resp = client.post("/api/friend-requests", json={"to_username": u2}, headers=headers1)
    assert resp.status_code == 200, resp.text

    # list incoming for u2
    resp = client.get("/api/friend-requests?direction=incoming", headers=headers2)
    assert resp.status_code == 200, resp.text
    inc = resp.json()
    assert len(inc) == 1
    req_id = inc[0]["id"]
    assert inc[0]["from_username"] == u1

    # accept as u2
    resp = client.post(f"/api/friend-requests/{req_id}/accept", headers=headers2)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"

    # verify friendships for both users
    resp = client.get("/api/friends", headers=headers1)
    assert resp.status_code == 200
    fr1 = resp.json()
    assert any(f["friend_username"] == u2 for f in fr1)

    resp = client.get("/api/friends", headers=headers2)
    assert resp.status_code == 200
    fr2 = resp.json()
    assert any(f["friend_username"] == u1 for f in fr2)

    # verify request status in DB
    req = db.friend_requests.find_one({"id": req_id}, {"_id": 0})
    assert req is not None and req.get("status") == "accepted"

    # cleanup created documents
    db.friends.delete_many({"$or": [{"user_id": id1}, {"user_id": id2}]})
    db.friend_requests.delete_many({"from_user_id": id1})
    db.friend_requests.delete_many({"from_user_id": id2})
    db.users.delete_many({"id": {"$in": [id1, id2]}})
