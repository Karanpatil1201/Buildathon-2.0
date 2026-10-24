import pytest
from pathlib import Path
from app.models import Inspection
from app.database import SessionLocal

def test_domain_gate_accepts_valid_steel_sample(client, operator_token):
    headers = {"Authorization": f"Bearer {operator_token}"}
    
    # Preset steel sample
    data = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "TEST-STEEL-001",
        "sample_preset": "eval_sample_defective_01.jpeg"
    }
    res = client.post("/api/v1/inspections", data=data, headers=headers)
    assert res.status_code == 201
    res_data = res.json()
    assert res_data["item_identifier"] == "TEST-STEEL-001"
    assert res_data["status"] == "UNDER_REVIEW"

def test_domain_gate_rejects_unrelated_image_with_422(client, operator_token):
    headers = {"Authorization": f"Bearer {operator_token}"}
    bug_image_path = Path("f:/Projects/model/images.jpeg")
    if not bug_image_path.exists():
        pytest.skip("images.jpeg not found")

    with SessionLocal() as db:
        initial_count = db.query(Inspection).count()

    with open(bug_image_path, "rb") as f:
        files = {"file": ("images.jpeg", f, "image/jpeg")}
        data = {
            "product_id": 1,
            "batch_id": 1,
            "item_identifier": "TEST-BUG-IMAGE"
        }
        res = client.post("/api/v1/inspections", data=data, files=files, headers=headers)

    # Must be HTTP 422 UNSUPPORTED_IMAGE_DOMAIN
    assert res.status_code == 422
    err_detail = res.json()["detail"]
    assert err_detail["code"] == "UNSUPPORTED_IMAGE_DOMAIN"
    assert "Unsupported image" in err_detail["message"]
    assert err_detail["rejection_code"] == "OUT_OF_DOMAIN_FEATURE"
    assert "diagnostics" in err_detail
    assert err_detail["diagnostics"]["residual_norm"] > err_detail["diagnostics"]["residual_threshold"]

    # Ensure zero DB records created
    with SessionLocal() as db:
        final_count = db.query(Inspection).count()
    assert final_count == initial_count
