import pytest

def test_login_success(client):
    res = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"

def test_login_invalid_password(client):
    res = client.post("/api/v1/auth/login", data={"username": "admin", "password": "wrongpassword"})
    assert res.status_code == 401
    assert "detail" in res.json()

def test_get_me(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["username"] == "admin"

def test_rbac_batch_hold_release(client, inspector_token, qm_token):
    # Inspector is NOT permitted to make batch decisions
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}
    res = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": "Inspector trying to hold batch"},
        headers=insp_headers
    )
    assert res.status_code == 403
    assert "Operation not permitted" in res.json()["detail"]

    # Quality Manager IS permitted to make batch decisions
    qm_headers = {"Authorization": f"Bearer {qm_token}"}
    res_qm = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": "Quality Manager formal quarantine decision"},
        headers=qm_headers
    )
    assert res_qm.status_code == 200
    assert res_qm.json()["status"] == "ON_HOLD"
