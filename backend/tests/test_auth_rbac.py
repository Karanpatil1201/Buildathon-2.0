import pytest
from datetime import datetime, timedelta

def test_login_success(client):
    res = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"
    assert "permissions" in data["user"]
    assert "users:read" in data["user"]["permissions"]

def test_login_invalid_password(client):
    res = client.post("/api/v1/auth/login", data={"username": "admin", "password": "wrongpassword"})
    assert res.status_code == 401
    assert "detail" in res.json()

def test_get_me(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["username"] == "admin"

# 1. Unauthenticated access returns 401
def test_unauthenticated_access_returns_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/inspections").status_code == 401
    assert client.get("/api/v1/batches").status_code == 401
    assert client.get("/api/v1/actions").status_code == 401
    assert client.get("/api/v1/defects").status_code == 401
    assert client.post("/api/v1/reviews/1", json={"decision": "PASSED"}).status_code == 401

# 2. Operator can create an inspection but cannot confirm its quality disposition
def test_operator_create_inspection_blocked_from_disposition(client, operator_token):
    headers = {"Authorization": f"Bearer {operator_token}"}

    # Operator creates an inspection -> ALLOWED (201)
    data = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "ITEM-OP-001",
        "sample_preset": "eval_sample_defective_01.jpeg"
    }
    create_res = client.post("/api/v1/inspections", data=data, headers=headers)
    assert create_res.status_code == 201
    insp_id = create_res.json()["id"]

    # Operator attempts to confirm quality disposition -> BLOCKED (403)
    review_res = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE"},
        headers=headers
    )
    assert review_res.status_code == 403
    assert "inspection:review" in review_res.json()["detail"]

# 3. Operator cannot access another user's restricted inspection (Object-level isolation)
def test_operator_object_level_access_isolation(client, operator_token, inspector_token):
    op_headers = {"Authorization": f"Bearer {operator_token}"}
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}

    # Inspector Marcus creates an inspection
    insp_data = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "ITEM-INSP-PRIVATE",
        "sample_preset": "eval_sample_defective_02.jpeg"
    }
    insp_res = client.post("/api/v1/inspections", data=insp_data, headers=insp_headers)
    assert insp_res.status_code == 201
    private_insp_id = insp_res.json()["id"]

    # Operator Alex attempts to access Inspector Marcus's inspection -> BLOCKED (403)
    blocked_get = client.get(f"/api/v1/inspections/{private_insp_id}", headers=op_headers)
    assert blocked_get.status_code == 403
    assert "Access denied" in blocked_get.json()["detail"]

# 4. Inspector can review authorized records but cannot manage user roles
def test_inspector_cannot_manage_users(client, inspector_token):
    headers = {"Authorization": f"Bearer {inspector_token}"}

    # Inspector attempts to modify a user's role -> BLOCKED (403)
    patch_res = client.patch(
        "/api/v1/auth/users/2",
        json={"role": "admin"},
        headers=headers
    )
    assert patch_res.status_code == 403
    assert "users:update" in patch_res.json()["detail"] or "roles:assign" in patch_res.json()["detail"]

# 5. Quality Manager can manage CAPA but cannot administer system accounts
def test_quality_manager_capa_and_admin_boundary(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}

    # QM creates a CAPA -> ALLOWED (201)
    act_data = {
        "defect_id": 1,
        "title": "Clean runner nozzles on Pouring Station 02",
        "description": "Remove slag buildup on gate.",
        "assigned_to_user_id": 4,
        "target_date": (datetime.utcnow() + timedelta(days=2)).isoformat()
    }
    capa_res = client.post("/api/v1/actions", json=act_data, headers=headers)
    assert capa_res.status_code == 201

    # QM attempts to register a new system user -> BLOCKED (403)
    reg_data = {
        "username": "unauthorized_user",
        "email": "unauth@forgesight.ai",
        "full_name": "Unauthorized User",
        "password": "pwd",
        "role": "admin"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_data, headers=headers)
    assert reg_res.status_code == 403
    assert "users:create" in reg_res.json()["detail"]

# 6. Inspector cannot verify CAPA, and Assignee cannot verify their own CAPA completion
def test_capa_verification_separation_of_duties(client, inspector_token, qm_token):
    qm_headers = {"Authorization": f"Bearer {qm_token}"}
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}

    # QM creates a CAPA assigned to Elena Vance herself (user id 2)
    act_data = {
        "defect_id": 1,
        "title": "Update furnace temperature calibration procedure",
        "description": "Standardize thermal curve.",
        "assigned_to_user_id": 2,  # Elena herself
        "target_date": (datetime.utcnow() + timedelta(days=5)).isoformat()
    }
    act_res = client.post("/api/v1/actions", json=act_data, headers=qm_headers)
    assert act_res.status_code == 201
    act_id = act_res.json()["id"]

    # Inspector Marcus attempts to verify -> BLOCKED (403: lacks capa:verify)
    insp_verify = client.patch(
        f"/api/v1/actions/{act_id}",
        json={"status": "VERIFIED"},
        headers=insp_headers
    )
    assert insp_verify.status_code == 403
    assert "capa:verify" in insp_verify.json()["detail"]

    # Assignee Elena attempts to verify HER OWN CAPA completion -> BLOCKED (403: separation of duties)
    self_verify = client.patch(
        f"/api/v1/actions/{act_id}",
        json={"status": "VERIFIED"},
        headers=qm_headers
    )
    assert self_verify.status_code == 403
    assert "Separation of duties policy violation" in self_verify.json()["detail"]

# 7. Unauthorized user cannot release or quarantine batches
def test_rbac_batch_hold_release(client, inspector_token, qm_token):
    # Inspector is NOT permitted to make batch decisions
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}
    res = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": "Inspector trying to hold batch"},
        headers=insp_headers
    )
    assert res.status_code == 403
    assert "batch:quarantine" in res.json()["detail"]

    # Quality Manager IS permitted to make batch decisions
    qm_headers = {"Authorization": f"Bearer {qm_token}"}
    res_qm = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": "Quality Manager formal quarantine decision"},
        headers=qm_headers
    )
    assert res_qm.status_code == 200
    assert res_qm.json()["status"] == "ON_HOLD"

# 8. Administrator can manage users but cannot bypass quality sign-off
def test_admin_cannot_bypass_quality_sign_off(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin attempts to confirm quality disposition -> BLOCKED (403)
    res = client.post(
        "/api/v1/reviews/1",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "CRACK"},
        headers=headers
    )
    assert res.status_code == 403
    assert "inspection:review" in res.json()["detail"]

    # Admin CAN update user full_name -> ALLOWED (200)
    update_res = client.patch(
        "/api/v1/auth/users/4",
        json={"full_name": "John Davis Sr. (Production Supervisor)"},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["full_name"] == "John Davis Sr. (Production Supervisor)"

# 9. Self-escalation protection: Users cannot grant themselves additional privileges
def test_self_escalation_protection(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin attempts to change their own role (self-promotion / self-escalation) -> BLOCKED (403)
    self_patch = client.patch(
        "/api/v1/auth/users/1",  # Admin's own user id is 1
        json={"role": "quality_manager"},
        headers=headers
    )
    assert self_patch.status_code == 403
    assert "Self-escalation policy violation" in self_patch.json()["detail"]

# 10. Unauthorized direct API requests rejected even if frontend is bypassed
def test_unauthorized_direct_api_calls_rejected(client, operator_token):
    headers = {"Authorization": f"Bearer {operator_token}"}

    # Operator directly calling PATCH /defects/1 -> BLOCKED (403)
    defect_patch = client.patch(
        "/api/v1/defects/1",
        json={"review_status": "RESOLVED"},
        headers=headers
    )
    assert defect_patch.status_code == 403
    assert "defect:update" in defect_patch.json()["detail"]

    # Operator directly calling POST /actions -> BLOCKED (403)
    action_post = client.post(
        "/api/v1/actions",
        json={"defect_id": 1, "title": "Bypassing UI", "assigned_to_user_id": 1, "target_date": "2026-10-30T00:00:00"},
        headers=headers
    )
    assert action_post.status_code == 403
    assert "capa:create" in action_post.json()["detail"]
