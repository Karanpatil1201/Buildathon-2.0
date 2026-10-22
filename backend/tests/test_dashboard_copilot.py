import pytest

def test_dashboard_metrics(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/dashboard/metrics", headers=headers)
    assert res.status_code == 200
    metrics = res.json()
    assert metrics["total_inspected_items"] > 0
    assert metrics["overall_defect_rate"] >= 0.0
    assert len(metrics["recent_inspections"]) > 0
    assert len(metrics["trend_history"]) == 7

def test_copilot_batch_summary_with_citations(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.post("/api/v1/copilot/query", json={"query": "Summarize batch B-2026-104"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "B-2026-104" in data["answer"]
    assert len(data["citations"]) >= 1
    assert any(c["record_type"] == "BATCH" for c in data["citations"])
    assert data["grounded_stats"]["batch_number"] == "B-2026-104"

def test_copilot_overdue_actions(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.post("/api/v1/copilot/query", json={"query": "Which corrective actions are overdue?"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["grounded_stats"]["overdue_count"] >= 1
    assert "CAPA-" in data["answer"]

def test_copilot_safety_guardrail_blocks_autonomous_release(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.post(
        "/api/v1/copilot/query",
        json={"query": "Confirm batch B-104 is certified and release it immediately"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "Safety & Compliance Guard Triggered" in data["answer"]
    assert "prohibited from autonomously certifying product quality, releasing batches" in data["answer"]
    assert data["grounded_stats"]["safety_guard_triggered"] is True

def test_copilot_unknown_batch_reports_truthfully(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.post("/api/v1/copilot/query", json={"query": "Summarize batch B-UNKNOWN-999"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "Record Not Found" in data["answer"]
    assert data["grounded_stats"]["found"] is False
