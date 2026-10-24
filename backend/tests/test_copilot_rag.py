import pytest
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import Batch, ConfirmedDefect, CorrectiveAction, User

def test_batch_hold_reason_query(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Why is batch B-2026-104 on hold?"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["authorized"] is True
    assert "B-2026-104" in data["answer"]
    assert "Hold" in data["answer"] or "ON_HOLD" in data["answer"]
    # Verify citations include the batch
    assert any(c["record_type"] == "BATCH" for c in data["citations"])

def test_defect_summary_separates_cnn_from_confirmed(client, inspector_token):
    headers = {"Authorization": f"Bearer {inspector_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Summarize the defects in batch B-2026-104."},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "B-2026-104" in data["answer"]
    # Check that confirmed facts or defect citations are present
    assert any(c["record_type"] == "DEFECT" for c in data["citations"])
    # If CNN predictions were found, check that the explicit label is used
    if "CNN" in data["answer"]:
        assert "CNN Model Prediction - Not Human Confirmed" in data["answer"] or "automated" in data["answer"].lower()

def test_overdue_actions_query(client, supervisor_token):
    # Ensure there is an overdue action
    with SessionLocal() as db:
        act = db.query(CorrectiveAction).first()
        if act:
            act.status = "IN_PROGRESS"
            act.target_date = datetime.utcnow() - timedelta(days=3)
            db.commit()

    headers = {"Authorization": f"Bearer {supervisor_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Which corrective actions are overdue?"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Overdue" in data["answer"] or "overdue" in data["answer"].lower()
    assert any(c["record_type"] in ["ACTION", "CAPA"] for c in data["citations"])

def test_procedure_sop_query(client, inspector_token):
    headers = {"Authorization": f"Bearer {inspector_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "What do our quality procedures say about crazing defect?"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Crazing" in data["answer"] or "microcrack" in data["answer"].lower()
    # Check procedure citation
    assert any(c["record_type"] == "PROCEDURE" for c in data["citations"])

def test_draft_capa_plan_is_draft_only(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Draft a corrective-action plan for batch B-2026-104."},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    # Must be explicitly marked as DRAFT for human review, not an authorized change
    assert "DRAFT" in data["answer"] or "Draft" in data["answer"]
    assert "Human" in data["answer"] or "human" in data["answer"].lower() or "Review" in data["answer"]

def test_quality_inspection_summary_query(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Generate a quality inspection summary."},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Summary" in data["answer"] or "summary" in data["answer"].lower()
    assert "Batches" in data["answer"] or "batches" in data["answer"].lower()

def test_safety_guard_blocks_auto_release(client, operator_token):
    headers = {"Authorization": f"Bearer {operator_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Confirm batch B-104 is certified safe and release it immediately"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Safety & Compliance Guard" in data["answer"]
    assert data["grounded_stats"].get("safety_guard_triggered") is True

def test_missing_evidence_honesty(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Why is batch B-UNKNOWN-999 on hold?"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Not Found" in data["answer"] or "missing" in data["answer"].lower() or "unavailable" in data["answer"].lower()
    assert data["grounded_stats"].get("found") is False

def test_unauthenticated_request_rejected(client):
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Why is batch B-2026-104 on hold?"}
    )
    assert res.status_code == 401
