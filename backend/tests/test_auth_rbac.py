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
    assert client.get("/api/v1/dashboard/metrics").status_code == 401
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

    # Operator directly calling GET /dashboard/metrics -> BLOCKED (403)
    dashboard_res = client.get("/api/v1/dashboard/metrics", headers=headers)
    assert dashboard_res.status_code == 403
    assert "dashboard:read" in dashboard_res.json()["detail"]

# 11. Reinspection comparison endpoint returns triad and honest assessment
def test_reinspection_comparison_triad(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.get("/api/v1/inspections/1/reinspection-comparison", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "original_inspection" in data
    assert "reference_image" in data
    assert "assessment_outcome" in data
    assert data["requires_human_approval"] is True



# 12. Production Supervisor permissions and strict boundary enforcement
def test_production_supervisor_permissions_and_boundaries(client, supervisor_token, qm_token):
    sup_headers = {"Authorization": f"Bearer {supervisor_token}"}
    qm_headers = {"Authorization": f"Bearer {qm_token}"}

    # Supervisor CAN read plant telemetry / dashboard
    dash_res = client.get("/api/v1/dashboard/metrics", headers=sup_headers)
    assert dash_res.status_code == 200

    # Supervisor CAN view defect register
    defects_res = client.get("/api/v1/defects", headers=sup_headers)
    assert defects_res.status_code == 200

    # Create a test CAPA task using QM
    act_data = {
        "defect_id": 1,
        "title": "Clean nozzle runner for supervisor test",
        "description": "Standard maintenance",
        "assigned_to_user_id": 4,  # Assigned to sup_davis
        "target_date": (datetime.utcnow() + timedelta(days=2)).isoformat()
    }
    capa_res = client.post("/api/v1/actions", json=act_data, headers=qm_headers)
    assert capa_res.status_code == 201
    capa_id = capa_res.json()["id"]

    # Supervisor CAN coordinate/update remediation progress (e.g. mark IN_PROGRESS or add notes)
    sup_update = client.patch(
        f"/api/v1/actions/{capa_id}",
        json={"status": "IN_PROGRESS", "description": "Crew dispatched to line"},
        headers=sup_headers
    )
    assert sup_update.status_code == 200

    # Supervisor is BLOCKED from approving quality disposition (403)
    review_res = client.post(
        "/api/v1/reviews/1",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE", "reason": "Supervisor attempt"},
        headers=sup_headers
    )
    assert review_res.status_code == 403
    assert "inspection:review" in review_res.json()["detail"]

    # Supervisor is BLOCKED from releasing a batch (403)
    batch_res = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "RELEASED", "reason": "Supervisor trying to release"},
        headers=sup_headers
    )
    assert batch_res.status_code == 403
    assert "batch:release" in batch_res.json()["detail"]

    # Supervisor is BLOCKED from verifying/closing CAPA (403)
    verify_res = client.patch(
        f"/api/v1/actions/{capa_id}",
        json={"status": "VERIFIED"},
        headers=sup_headers
    )
    assert verify_res.status_code == 403
    assert "capa:verify" in verify_res.json()["detail"]


# 13. System Admin separation of powers (no quality approvals, no batch release, no CAPA closure)
def test_system_admin_separation_of_powers(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin CAN view security audit log
    audit_res = client.get("/api/v1/auth/audit", headers=headers)
    assert audit_res.status_code == 200

    # Admin CAN list users
    users_res = client.get("/api/v1/auth/users", headers=headers)
    assert users_res.status_code == 200

    # Admin CANNOT release batches
    batch_res = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "RELEASED", "reason": "Admin unauthorized release"},
        headers=headers
    )
    assert batch_res.status_code == 403
    assert "batch:release" in batch_res.json()["detail"]

    # Admin CANNOT close/verify CAPA
    capa_res = client.patch(
        "/api/v1/actions/1",
        json={"status": "VERIFIED"},
        headers=headers
    )
    assert capa_res.status_code == 403
    assert "capa:verify" in capa_res.json()["detail"]

    # Admin CANNOT confirm defect dispositions
    review_res = client.post(
        "/api/v1/reviews/1",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "CRACK", "reason": "Admin quality review attempt"},
        headers=headers
    )
    assert review_res.status_code == 403
    assert "inspection:review" in review_res.json()["detail"]


# 14. Mandatory justification reasons for batch decisions
def test_batch_decision_mandatory_reason_validation(client, qm_token):
    qm_headers = {"Authorization": f"Bearer {qm_token}"}

    # Reject empty string
    res_empty = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": ""},
        headers=qm_headers
    )
    assert res_empty.status_code == 400
    assert "reason is required" in res_empty.json()["detail"].lower()

    # Reject whitespace only
    res_spaces = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": "    "},
        headers=qm_headers
    )
    assert res_spaces.status_code == 400

    # Accept valid substantive reason
    res_valid = client.post(
        "/api/v1/batches/1/decisions",
        json={"new_status": "ON_HOLD", "reason": "Suspected ladle nozzle erosion; placing coil batch under quarantine."},
        headers=qm_headers
    )
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "ON_HOLD"


# 15. Mandatory justification reasons for defect reviews
def test_defect_review_mandatory_reason_validation(client, qm_token, inspector_token):
    # Operator Alex creates an inspection
    op_login = client.post("/api/v1/auth/login", data={"username": "op_alex", "password": "op123"})
    op_token = op_login.json()["access_token"]
    op_headers = {"Authorization": f"Bearer {op_token}"}
    qm_headers = {"Authorization": f"Bearer {qm_token}"}

    create_res = client.post(
        "/api/v1/inspections",
        data={
            "product_id": 1,
            "batch_id": 1,
            "item_identifier": "COIL-REASON-TEST",
            "sample_preset": "eval_sample_defective_01.jpeg"
        },
        headers=op_headers
    )
    assert create_res.status_code == 201
    insp_id = create_res.json()["id"]

    # Attempt to review without any reason or notes -> BLOCKED (400)
    res_no_reason = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE", "reason": ""},
        headers=qm_headers
    )
    assert res_no_reason.status_code == 400
    assert "mandatory" in res_no_reason.json()["detail"].lower() or "reason" in res_no_reason.json()["detail"].lower()

    # Provide substantive reason -> ALLOWED (200)
    res_with_reason = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE", "reason": "High-density surface voids confirmed under optical microscopy."},
        headers=qm_headers
    )
    assert res_with_reason.status_code == 200
    assert res_with_reason.json()["status"] == "CONFIRMED_DEFECT"


# 16. Self-approval prevention on inspections using authenticated actor IDs
def test_self_approval_prevention_on_inspections(client, inspector_token, qm_token):
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}
    qm_headers = {"Authorization": f"Bearer {qm_token}"}

    # Inspector Marcus Lee creates an inspection
    create_res = client.post(
        "/api/v1/inspections",
        data={
            "product_id": 1,
            "batch_id": 1,
            "item_identifier": "COIL-SELF-APPROVE-TEST",
            "sample_preset": "eval_sample_defective_02.jpeg"
        },
        headers=insp_headers
    )
    assert create_res.status_code == 201
    insp_id = create_res.json()["id"]

    # Inspector Marcus attempts to approve his own inspection -> BLOCKED (403: Separation of duties)
    self_review = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE", "reason": "Self approving my own find"},
        headers=insp_headers
    )
    assert self_review.status_code == 403
    assert "Separation of duties" in self_review.json()["detail"]

    # Independent reviewer (QM Elena Vance) reviews -> ALLOWED (200)
    peer_review = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE", "reason": "Peer verification completed by Quality Manager."},
        headers=qm_headers
    )
    assert peer_review.status_code == 200


# 17. Image serving authorization and object isolation
def test_image_serving_authorization_and_isolation(client, operator_token, inspector_token):
    # Public eval sample is accessible without token
    pub_res = client.get("/api/v1/inspections/images/eval_sample_ok_01.jpeg")
    assert pub_res.status_code == 200

    # Non-eval unknown / proprietary image requested without token returns 401
    anon_res = client.get("/api/v1/inspections/images/nonexistent_or_proprietary.jpg")
    assert anon_res.status_code == 401

    # Inspector Marcus creates an inspection with an uploaded image or preset
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}
    insp_res = client.post(
        "/api/v1/inspections",
        data={
            "product_id": 1,
            "batch_id": 1,
            "item_identifier": "COIL-IMG-AUTH-TEST",
            "sample_preset": "eval_sample_defective_01.jpeg"
        },
        headers=insp_headers
    )
    assert insp_res.status_code == 201
    img_filename = insp_res.json()["latest_image_url"].split("/")[-1]

    # Inspector Marcus can download it with auth header
    dl_insp = client.get(f"/api/v1/inspections/images/{img_filename}", headers=insp_headers)
    assert dl_insp.status_code == 200

    # Inspector Marcus can also download it with token query parameter (e.g. for browser <img> tags)
    dl_query = client.get(f"/api/v1/inspections/images/{img_filename}?token={inspector_token}")
    assert dl_query.status_code == 200


# 18. Session switching and token authenticity
def test_session_switching_and_tampered_token(client):
    # Login as Operator Alex
    op_res = client.post("/api/v1/auth/login", data={"username": "op_alex", "password": "op123"})
    assert op_res.status_code == 200
    op_token = op_res.json()["access_token"]
    assert op_res.json()["user"]["role"] == "production_operator"

    # Switch session: login as Quality Manager Elena
    qm_res = client.post("/api/v1/auth/login", data={"username": "qm_elena", "password": "qm123"})
    assert qm_res.status_code == 200
    qm_token = qm_res.json()["access_token"]
    assert qm_res.json()["user"]["role"] == "quality_manager"
    assert qm_token != op_token

    # Verify tampered token is rejected
    tampered_headers = {"Authorization": "Bearer invalid.fake.token"}
    tampered_res = client.get("/api/v1/auth/me", headers=tampered_headers)
    assert tampered_res.status_code == 401
