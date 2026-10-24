import pytest
from pathlib import Path
from app.config import settings

def test_eval_samples_available(client):
    res = client.get("/api/v1/inspections/eval-samples")
    assert res.status_code == 200
    samples = res.json()
    assert len(samples) >= 10
    assert any(s["ground_truth"] == "DEFECTIVE" for s in samples)
    assert any(s["ground_truth"] == "OK" for s in samples)

def test_create_inspection_with_preset_sample_runs_real_ml(client, inspector_token):
    headers = {"Authorization": f"Bearer {inspector_token}"}
    
    # Post inspection using preset sample
    data = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "ITEM-PYTEST-001",
        "notes": "Pytest automated inspection test with real PyTorch inference",
        "sample_preset": "eval_sample_defective_02.jpeg"
    }

    res = client.post("/api/v1/inspections", data=data, headers=headers)
    assert res.status_code == 201
    detail = res.json()
    assert detail["item_identifier"] == "ITEM-PYTEST-001"
    assert len(detail["images"]) >= 1
    assert len(detail["inference_attempts"]) >= 1

    latest_inf = detail["inference_attempts"][0]
    assert latest_inf["model_name"] == "MobileNetV3-Steel-Inspector"
    assert latest_inf["model_version"] == "v1.0.0-industrial"
    assert latest_inf["status"] == "SUCCESS"
    assert latest_inf["raw_prediction"] in ["DEFECTIVE", "OK"]
    assert 0.0 <= latest_inf["confidence_score"] <= 1.0
    assert 0.0 <= latest_inf["defect_probability"] <= 1.0
    assert latest_inf["inference_duration_ms"] > 0.0

    # Verify Grad-CAM heatmap was generated
    assert detail["images"][0]["heatmap_path"] is not None

def test_retry_inference(client, inspector_token):
    headers = {"Authorization": f"Bearer {inspector_token}"}
    
    # Create inspection first
    data = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "ITEM-PYTEST-RETRY",
        "sample_preset": "eval_sample_ok_02.jpeg"
    }
    create_res = client.post("/api/v1/inspections", data=data, headers=headers)
    assert create_res.status_code == 201
    insp_id = create_res.json()["id"]

    # Retry inference
    retry_res = client.post(f"/api/v1/inspections/{insp_id}/retry-inference", headers=headers)
    assert retry_res.status_code == 200
    att = retry_res.json()
    assert att["status"] == "SUCCESS"
    assert att["raw_prediction"] == "OK"

    # Verify inspection detail has multiple attempts
    detail_res = client.get(f"/api/v1/inspections/{insp_id}", headers=headers)
    assert len(detail_res.json()["inference_attempts"]) >= 2
