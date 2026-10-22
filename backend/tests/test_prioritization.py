import pytest

def test_prioritization_queue_calculation(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/prioritization/queue", headers=headers)
    assert res.status_code == 200
    queue = res.json()
    assert isinstance(queue, list)
    if len(queue) > 0:
        first = queue[0]
        assert "priority_score" in first
        assert "priority_tier" in first
        assert "factors" in first
        assert 0.0 <= first["priority_score"] <= 100.0
        assert first["priority_tier"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        assert len(first["factors"]) > 0

def test_prioritization_benchmark_evaluation(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/prioritization/benchmark", headers=headers)
    assert res.status_code == 200
    bench = res.json()
    assert "fifo_baseline" in bench
    assert "evidence_driven_priority" in bench
    assert "efficiency_gain_pct" in bench["evidence_driven_priority"]
    assert bench["evidence_driven_priority"]["efficiency_gain_pct"] > 50.0
