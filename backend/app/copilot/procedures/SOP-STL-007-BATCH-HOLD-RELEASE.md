# SOP-STL-007: Quality Governance Protocol: Batch Hold, Quarantine & Release Authority
**Document ID**: DOC-SOP-007
**Standard**: ISO 9001:2015 Clause 8.6 & IATF 16949 Section 8.6.2
**Applicability**: Plant-Wide Steel Manufacturing Quality Governance

### Mandatory Policy Rules
1. **Separation of Governance**: Autonomous automated release of lots by AI, computer vision models, or unverified software routines is strictly prohibited.
2. **Authorized Release Sign-Off**: Only a certified Quality Manager (`Role.QUALITY_MANAGER`) possesses the authority to release a quarantined lot (`ON_HOLD` -> `RELEASED`).
3. **Prerequisites for Release**:
   - All critical severity defects (`DEF-XXXX`) must be marked `RESOLVED`.
   - All linked corrective actions (`CAPA-XXXX`) must be signed off as `VERIFIED`.
   - A documented, substantive justification reason must be entered in the immutable audit log.
4. **Immediate Quarantine Triggers**:
   - Multiple recurring critical defects on the same heat or roll campaign.
   - Overdue corrective actions on active production lines.
   - Unresolved reinspection failures (`DEFECT_STILL_PRESENT`).
