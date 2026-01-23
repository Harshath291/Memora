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


def test_remove_friend_flow():
    ts = int(time.time())
    u1 = f"testuser_a_{ts}"
    u2 = f"testuser_b_{ts}"

    token1, id1, _ = create_user(u1)
    token2, id2, _ = create_user(u2)

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # send friend request and accept
    resp = client.post("/api/friend-requests", json={"to_username": u2}, headers=headers1)
    assert resp.status_code == 200
    resp = client.get("/api/friend-requests?direction=incoming", headers=headers2)
    reqs = resp.json()
    req_id = reqs[0]['id']
    resp = client.post(f"/api/friend-requests/{req_id}/accept", headers=headers2)
    assert resp.status_code == 200

    # ensure friends exist
    resp = client.get("/api/friends", headers=headers1)
    assert any(f['friend_username'] == u2 for f in resp.json())
    resp = client.get("/api/friends", headers=headers2)
    assert any(f['friend_username'] == u1 for f in resp.json())

    # remove friend as u1
    resp = client.delete(f"/api/friends/{u2}", headers=headers1)
    assert resp.status_code == 200
    assert resp.json()['status'] == 'removed'

    # verify removal both sides
    resp = client.get("/api/friends", headers=headers1)
    assert all(f['friend_username'] != u2 for f in resp.json())
    resp = client.get("/api/friends", headers=headers2)
    assert all(f['friend_username'] != u1 for f in resp.json())

    # cleanup
    db.friends.delete_many({"$or": [{"user_id": id1}, {"user_id": id2}]})
    db.friend_requests.delete_many({"from_user_id": id1})
    db.friend_requests.delete_many({"from_user_id": id2})
    db.users.delete_many({"id": {"$in": [id1, id2]}})
