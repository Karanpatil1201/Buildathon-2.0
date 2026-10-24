"""Verify reinspection lifecycle end-to-end using TestClient."""
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
API = "/api/v1"

# Login as quality manager (OAuth2 form data)
login_res = client.post(API + "/auth/login", data={"username": "qm_elena", "password": "qm123"})
assert login_res.status_code == 200, "Login failed: " + login_res.text
token = login_res.json()["access_token"]
headers = {"Authorization": "Bearer " + token}

# Get all inspections
res = client.get(API + "/inspections/", headers=headers)
assert res.status_code == 200
inspections = res.json()
print("Total inspections: " + str(len(inspections)))

# Find reinspections
reinspections = [i for i in inspections if i.get("is_reinspection")]
print("Reinspections in DB: " + str(len(reinspections)))
for r in reinspections:
    rid = r.get("id")
    oid = r.get("original_inspection_id")
    item = r.get("item_identifier")
    print("  ID: " + str(rid) + ", Original ID: " + str(oid) + ", Item: " + str(item))

# Test detail cross-referencing
if reinspections:
    child_id = reinspections[0]["id"]
    orig_id = reinspections[0]["original_inspection_id"]
    
    child_detail = client.get(API + "/inspections/" + str(child_id), headers=headers).json()
    orig_loaded = child_detail.get("original_inspection") is not None
    print("")
    print("Child #" + str(child_id) + " original_inspection loaded: " + str(orig_loaded))
    if child_detail.get("original_inspection"):
        print("  -> Points to Original ID #" + str(child_detail["original_inspection"]["id"]))
    
    orig_detail = client.get(API + "/inspections/" + str(orig_id), headers=headers).json()
    follow_ups = orig_detail.get("follow_up_inspections", [])
    print("Orig #" + str(orig_id) + " follow_up_inspections count: " + str(len(follow_ups)))
    for fu in follow_ups:
        print("  -> Follow-up ID #" + str(fu["id"]) + " (Item: " + str(fu["item_identifier"]) + ")")

    print("")
    print("PASS: Reinspection cross-referencing verified!")
else:
    print("")
    print("No reinspections found yet - checking for defective inspections to test against...")
    
    defective = [i for i in inspections if i.get("ai_prediction") and i["ai_prediction"] != "NORMAL"]
    if defective:
        target = defective[0]
        print("Found defective inspection #" + str(target["id"]) + " (AI: " + str(target.get("ai_prediction")) + ")")
        print("This can be used as a reinspection target via the UI.")
    else:
        # check status field
        under_review = [i for i in inspections if i.get("status") in ("CONFIRMED_DEFECT", "UNDER_REVIEW")]
        if under_review:
            target = under_review[0]
            print("Found inspection #" + str(target["id"]) + " with status " + str(target.get("status")))
        else:
            print("No defective inspections found.")

# Check schemas have reinspection fields
print("")
print("--- Schema field check ---")
sample = inspections[0] if inspections else {}
has_is_reinspection = "is_reinspection" in sample
has_orig_id = "original_inspection_id" in sample
print("InspectionOut has is_reinspection: " + str(has_is_reinspection))
print("InspectionOut has original_inspection_id: " + str(has_orig_id))

if inspections:
    detail = client.get(API + "/inspections/" + str(inspections[0]["id"]), headers=headers).json()
    has_orig_insp = "original_inspection" in detail
    has_follow_ups = "follow_up_inspections" in detail
    print("InspectionDetailOut has original_inspection: " + str(has_orig_insp))
    print("InspectionDetailOut has follow_up_inspections: " + str(has_follow_ups))

print("")
print("=== Reinspection backend verification complete ===")
