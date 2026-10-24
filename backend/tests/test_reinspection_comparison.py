import pytest
from datetime import datetime, timedelta

def test_reinspection_full_before_after_comparison_workflow(client, operator_token, inspector_token, qm_token):
    # 1. Inspector creates an original inspection with a defect preset
    headers_insp = {"Authorization": f"Bearer {inspector_token}"}
    headers_qm = {"Authorization": f"Bearer {qm_token}"}

    data_orig = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "COIL-REINSP-001",
        "sample_preset": "eval_sample_defective_01.jpeg",
        "notes": "Original defect detected on casting line 1"
    }
    res_orig = client.post("/api/v1/inspections", data=data_orig, headers=headers_insp)
    assert res_orig.status_code == 201
    orig_id = res_orig.json()["id"]

    # 2. Confirm defect and create a linked corrective action (CAPA)
    res_review = client.post(
        f"/api/v1/reviews/{orig_id}",
        json={"decision": "CONFIRMED_DEFECT", "defect_category": "BLOWHOLE", "notes": "Blowhole defect confirmed"},
        headers=headers_qm
    )
    assert res_review.status_code == 200
    defect_id = res_review.json()["defect"]["id"]

    res_capa = client.post(
        "/api/v1/actions",
        json={
            "defect_id": defect_id,
            "title": "Precision Grind & Reweld",
            "description": "Surface weld build-up and precision grind",
            "assigned_to_user_id": 1,
            "target_date": (datetime.utcnow() + timedelta(days=2)).isoformat()
        },
        headers=headers_qm
    )
    assert res_capa.status_code == 201
    action_id = res_capa.json()["id"]

    # 3. Create a follow-up reinspection with a clean (OK) preset sample
    data_post = {
        "product_id": 1,
        "batch_id": 1,
        "item_identifier": "COIL-REINSP-001",
        "sample_preset": "eval_sample_ok_01.jpeg",
        "is_reinspection": True,
        "original_inspection_id": orig_id,
        "image_scope": "ITEM",
        "linked_action_id": action_id,
        "notes": "Post-rework reinspection verification"
    }
    res_post = client.post("/api/v1/inspections", data=data_post, headers=headers_insp)
    assert res_post.status_code == 201
    post_id = res_post.json()["id"]

    # 4. Fetch the comparison triad
    res_comp = client.get(f"/api/v1/inspections/{post_id}/reinspection-comparison", headers=headers_qm)
    assert res_comp.status_code == 200
    comp = res_comp.json()
    assert comp["original_inspection"]["id"] == orig_id
    assert comp["reinspection"]["id"] == post_id
    assert comp["comparison_suggestion"] == "LIKELY_IMPROVED"
    assert comp["requires_human_approval"] is True
    assert comp["linked_defect"]["id"] == defect_id
    assert comp["linked_capa"]["id"] == action_id

    # 5. Separation of Duties: Submitting inspector CANNOT review/approve the comparison
    res_sub_review = client.post(
        f"/api/v1/inspections/{post_id}/comparison-review",
        json={"decision": "CONFIRM_CORRECTION", "notes": "I approve my own fix", "close_capa": True},
        headers=headers_insp
    )
    assert res_sub_review.status_code == 403
    assert "Separation of duties" in res_sub_review.json()["detail"]

    # 6. Quality Manager signs off with CONFIRM_CORRECTION and closes CAPA
    res_qm_review = client.post(
        f"/api/v1/inspections/{post_id}/comparison-review",
        json={"decision": "CONFIRM_CORRECTION", "notes": "Surface verified smooth and defect-free under magnification.", "close_capa": True},
        headers=headers_qm
    )
    assert res_qm_review.status_code == 200
    audit_data = res_qm_review.json()
    assert audit_data["comparison_decision"] == "CONFIRM_CORRECTION"
    assert audit_data["reinspection_record"]["comparison_decision"] == "CONFIRM_CORRECTION"
    assert audit_data["reinspection_record"]["reviewer_notes"] == "Surface verified smooth and defect-free under magnification."

    # 7. Verify CAPA status updated to VERIFIED via actions list and comparison triad
    res_capa_list = client.get("/api/v1/actions", headers=headers_qm)
    assert res_capa_list.status_code == 200
    matching = [a for a in res_capa_list.json() if a["id"] == action_id]
    assert len(matching) == 1
    assert matching[0]["status"] == "VERIFIED"

    # Also verify reinspection comparison payload reports linked CAPA as VERIFIED
    res_comp_updated = client.get(f"/api/v1/inspections/{post_id}/reinspection-comparison", headers=headers_qm)
    assert res_comp_updated.json()["linked_capa"]["status"] == "VERIFIED"
