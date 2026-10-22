import pytest
from datetime import datetime, timedelta

def test_human_review_and_separation_of_duties(client, inspector_token, qm_token):
    # 1. Inspector Marcus creates an inspection
    insp_headers = {"Authorization": f"Bearer {inspector_token}"}
    data = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "ITEM-SEP-DUTIES",
        "sample_preset": "eval_sample_defective_03.jpeg"
    }
    insp_res = client.post("/api/v1/inspections", data=data, headers=insp_headers)
    assert insp_res.status_code == 201
    insp_id = insp_res.json()["id"]

    # 2. Inspector Marcus attempts to approve their own inspection -> MUST BE BLOCKED
    blocked_res = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={"decision": "NO_DEFECT_CONFIRMED", "reason": "Inspector trying to approve own work"},
        headers=insp_headers
    )
    assert blocked_res.status_code == 403
    assert "Separation of duties policy violation" in blocked_res.json()["detail"]

    # 3. Quality Manager Elena reviews the inspection -> ALLOWED
    qm_headers = {"Authorization": f"Bearer {qm_token}"}
    approved_res = client.post(
        f"/api/v1/reviews/{insp_id}",
        json={
            "decision": "CONFIRMED_DEFECT",
            "reason": "Confirmed pinhole cluster",
            "defect_category": "PINHOLE",
            "severity": "MAJOR"
        },
        headers=qm_headers
    )
    assert approved_res.status_code == 200
    detail = approved_res.json()
    assert detail["status"] == "CONFIRMED_DEFECT"
    assert detail["defect"] is not None
    assert detail["defect"]["defect_category"] == "PINHOLE"

def test_corrective_action_lifecycle(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}

    # Retrieve confirmed defects
    defects = client.get("/api/v1/defects", headers=headers).json()
    assert len(defects) >= 1
    target_defect = defects[0]

    # Create corrective action
    act_data = {
        "defect_id": target_defect["id"],
        "title": "Recalibrate sand mixture moisture analyzer",
        "description": "Perform daily calibration of moisture sensors on green sand mixer line.",
        "assigned_to_user_id": 4,  # Supervisor Davis
        "target_date": (datetime.utcnow() + timedelta(days=3)).isoformat()
    }
    act_res = client.post("/api/v1/actions", json=act_data, headers=headers)
    assert act_res.status_code == 201
    act = act_res.json()
    assert act["status"] == "PENDING"
    assert "CAPA-" in act["action_code"]

    # Update corrective action to COMPLETED
    update_res = client.patch(
        f"/api/v1/actions/{act['id']}",
        json={"status": "COMPLETED", "notes": "Moisture analyzer calibrated and certified by vendor"},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "COMPLETED"
    assert update_res.json()["completed_at"] is not None
