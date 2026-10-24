import pytest
import uuid

def test_list_products(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/products", headers=headers)
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 3
    assert any(p["code"] in ["STL-AHSS-01", "CAST-PUMP-01"] for p in products)

def test_create_and_get_product(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}
    unique_code = f"CAST-TEST-{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/products",
        json={
            "code": unique_code,
            "name": "High-Strength Galvanized Steel Coil",
            "category": "Coated Steel Sheets",
            "description": "Hot-dip galvanized steel coil for exposed automotive panels."
        },
        headers=headers
    )
    assert res.status_code == 201
    prod_id = res.json()["id"]

    # Retrieve
    get_res = client.get(f"/api/v1/products/{prod_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "High-Strength Galvanized Steel Coil"

def test_create_batch_and_decision_history(client, qm_token):
    headers = {"Authorization": f"Bearer {qm_token}"}
    batch_num = f"B-TEST-{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/batches",
        json={
            "product_id": 1,
            "batch_number": batch_num,
            "quantity": 150
        },
        headers=headers
    )
    assert res.status_code == 201
    batch_id = res.json()["id"]
    assert res.json()["status"] == "IN_PROGRESS"

    # Make decision: hold
    hold_res = client.post(
        f"/api/v1/batches/{batch_id}/decisions",
        json={"new_status": "ON_HOLD", "reason": "Suspected roll scale inclusion on coil head"},
        headers=headers
    )
    assert hold_res.status_code == 200
    assert hold_res.json()["status"] == "ON_HOLD"

    # View history
    hist_res = client.get(f"/api/v1/batches/{batch_id}/decisions", headers=headers)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    assert history[0]["new_status"] == "ON_HOLD"
