import pytest
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import Batch, ConfirmedDefect, CorrectiveAction, User

def test_exact_query_why_b2026_101_batch_is_on_the_hold(client, qm_token):
    """
    Regression Test for Issue 2:
    Query: 'why B-2026-101 batch is on the hold'
    Must extract 'B-2026-101' (NOT 'IS') and retrieve the real batch record.
    """
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "why B-2026-101 batch is on the hold"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["authorized"] is True
    assert "B-2026-101" in data["answer"]
    assert "ON_HOLD" in data["answer"] or "Hold" in data["answer"]
    # Verify that the extracted batch was B-2026-101, not 'IS'
    assert data["grounded_stats"].get("batch_number") == "B-2026-101"
    # Citations must include B-2026-101
    assert any(c["record_type"] == "BATCH" and "B-2026-101" in c["record_id"] for c in data["citations"])

def test_batch_hold_reason_query_104(client, qm_token):
    """
    Query: 'Why is batch B-2026-104 on hold?'
    """
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
    assert any(c["record_type"] == "BATCH" and "B-2026-104" in c["record_id"] for c in data["citations"])

def test_procedure_sop_query_crazing(client, inspector_token):
    """
    Query: 'What do our quality procedures say about crazing?'
    """
    headers = {"Authorization": f"Bearer {inspector_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "What do our quality procedures say about crazing?"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Crazing" in data["answer"] or "microcrack" in data["answer"].lower()
    assert any(c["record_type"] == "PROCEDURE" for c in data["citations"])

def test_draft_capa_plan_query_104(client, qm_token):
    """
    Query: 'Draft a corrective-action plan for batch B-2026-104.'
    """
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Draft a corrective-action plan for batch B-2026-104."},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "DRAFT" in data["answer"] or "Draft" in data["answer"]
    assert "Human" in data["answer"] or "human" in data["answer"].lower() or "Review" in data["answer"]

def test_missing_evidence_honesty_unknown_999(client, qm_token):
    """
    Query: 'Why is batch B-UNKNOWN-999 on hold?'
    Zero hallucination policy: must report not found, never hallucinate facts.
    """
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Why is batch B-UNKNOWN-999 on hold?"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Not Found" in data["answer"] or "missing" in data["answer"].lower()
    assert data["grounded_stats"].get("found") is False
    assert len(data["citations"]) == 0

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
    assert any(c["record_type"] == "DEFECT" for c in data["citations"])
    if "CNN" in data["answer"]:
        assert "CNN Model Prediction" in data["answer"]

def test_overdue_actions_query(client, supervisor_token):
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

def test_unauthenticated_request_rejected(client):
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Why is batch B-2026-104 on hold?"}
    )
    assert res.status_code == 401

def test_sse_streaming_stages_endpoint(client, qm_token):
    """
    Test SSE streaming endpoint (/api/v1/copilot/stream).
    Must stream real stages (Understanding, Retrieving, Checking SOPs, Generating).
    """
    headers = {"Authorization": f"Bearer {qm_token}"}
    res = client.post(
        "/api/v1/copilot/stream",
        json={"query": "why B-2026-101 batch is on the hold"},
        headers=headers
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
    content = res.text
    assert "event: stage" in content
    assert "Understanding your question" in content
    assert "Retrieving batch and inspection records" in content
    assert "event: result" in content
    assert "event: done" in content
