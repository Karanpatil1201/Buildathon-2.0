import requests

base_url = 'http://127.0.0.1:8000/api/v1'

# 1. Login as Quality Manager
login_res = requests.post(f'{base_url}/auth/login', data={'username': 'qm_elena', 'password': 'qm123'})
token = login_res.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 2. Get list of inspections
insps = requests.get(f'{base_url}/inspections', headers=headers).json()
print('Total inspections in system:', len(insps))

# Find a defective inspection to link to
failed_insp = next((i for i in insps if i.get('latest_prediction') == 'DEFECTIVE'), insps[0])
print(f"Selected Original Failed Inspection: #{failed_insp['id']} ({failed_insp['item_identifier']}) - Finding: {failed_insp.get('latest_defect_type')}")

# 3. Create a Follow-up Reinspection linked to it
re_data = {
    'product_id': failed_insp['product_id'],
    'batch_id': failed_insp['batch_id'],
    'item_identifier': f"{failed_insp['item_identifier']}-RETEST",
    'notes': f"Follow-up verification scan linked to original #{failed_insp['id']}",
    'is_reinspection': 'true',
    'original_inspection_id': str(failed_insp['id']),
    'sample_preset': 'eval_sample_ok_01.jpeg'
}

create_res = requests.post(f'{base_url}/inspections', data=re_data, headers=headers)
print('Create reinspection status code:', create_res.status_code)
re_insp = create_res.json()
print(f"Created Reinspection #{re_insp['id']}: is_reinspection={re_insp['is_reinspection']}, original_inspection_id={re_insp['original_inspection_id']}")
print(f"Reinspection ML Verdict: {re_insp.get('latest_prediction')} | Defect Type: {re_insp.get('latest_defect_type')}")

# 4. Fetch detail of reinspection (verifying original inspection summary linkage)
detail_res = requests.get(f"{base_url}/inspections/{re_insp['id']}", headers=headers).json()
print('Reinspection has original_inspection summary linkage?', detail_res.get('original_inspection') is not None)
if detail_res.get('original_inspection'):
    orig = detail_res['original_inspection']
    print(f"  -> Linked to Original #{orig['id']} ({orig['item_identifier']}), Verdict: {orig.get('latest_prediction')} ({orig.get('latest_defect_type')})")

# 5. Fetch detail of original inspection (verifying follow-up reinspections list)
orig_detail = requests.get(f"{base_url}/inspections/{failed_insp['id']}", headers=headers).json()
print('Original inspection lists follow-up reinspections?', len(orig_detail.get('follow_up_inspections', [])) > 0)
for f in orig_detail.get('follow_up_inspections', []):
    print(f"  -> Follow-up Reinspection #{f['id']}: {f['item_identifier']} (Outcome: {f.get('latest_prediction')})")

# 6. Submit human review on the reinspection confirming it passed
review_payload = {
    'decision': 'NO_DEFECT_CONFIRMED',
    'reason': 'Surface defect ground out and polished. Reinspection confirms flawless prime metal surface.',
    'notes': 'Quality verified under ATS Inspect standard. CAPA resolution verified.'
}
rev_res = requests.post(f"{base_url}/reviews/{re_insp['id']}", json=review_payload, headers=headers)
print('Review submission status:', rev_res.status_code)
reviewed_insp = rev_res.json()
print('Reinspection Status after certified sign-off:', reviewed_insp['status'])
