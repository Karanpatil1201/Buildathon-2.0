import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models import User, Batch, BatchDecision, Inspection, ConfirmedDefect, CorrectiveAction, InferenceAttempt, HumanReview
from app.schemas import CopilotResponse, CopilotCitation
from app.config import settings
from app.copilot.retriever import rag_retriever
from app.copilot.gemini_client import gemini_client

class QualityCopilotEngine:
    """
    GenAI + Lightweight RAG Quality Copilot Engine for ForgeSight AI / Steel-IQ.
    
    1. Gathers authorized structured facts (batches, confirmed defects, CAPAs) and local SOPs.
    2. Explicitly separates human-confirmed defects from CNN model predictions.
    3. Leverages official Google GenAI SDK (Gemini) when configured.
    4. Provides robust deterministic grounded RAG fallback with explicit reason when Gemini is offline.
    5. Enforces safety guardrails: no autonomous batch release or defect closure.
    """
    def __init__(self):
        self.provider = settings.GENAI_PROVIDER

    def check_safety_guard(self, query_str: str) -> Optional[CopilotResponse]:
        """
        Intercepts autonomous state mutation attempts (certify, release, approve).
        """
        query_lower = query_str.lower().strip()
        mutation_verbs = ["certify", "override defect", "close defect", "approve batch", "quarantine batch", "unhold batch"]
        is_release_attempt = "release" in query_lower and any(b in query_lower for b in ["batch", "it", "product", "hold", "coil", "heat"])
        if any(w in query_lower for w in mutation_verbs) or is_release_attempt:
            return CopilotResponse(
                query=query_str,
                answer=(
                    "**Safety & Compliance Guard Triggered**: GenAI is strictly an advisory decision-support assistant and "
                    "is **prohibited from autonomously certifying product quality, releasing batches, closing defects, or changing compliance states**.\n\n"
                    "- **Standard Protocol**: Batch disposition and defect closure require physical human inspection and authorization "
                    "by an assigned Quality Manager per standard ISO 9001 / IATF 16949 quality assurance protocols.\n"
                    "- **Permitted Action**: You can ask me to *\"Draft a corrective-action plan\"* or *\"Summarize why this batch is on hold\"* "
                    "for human review."
                ),
                citations=[],
                grounded_stats={"safety_guard_triggered": True, "policy": "Human-in-the-loop mandatory"},
                provider="ForgeSight Grounded Governance Engine",
                authorized=True
            )
        return None

    def synthesize_from_retrieved(
        self,
        query_str: str,
        retrieved: Dict[str, Any],
        db: Session,
        batch_param: Optional[str] = None
    ) -> CopilotResponse:
        """
        Synthesizes the final response from retrieved context, attempting Gemini first,
        then falling back to the deterministic synthesizer with an explicit provider label.
        """
        query_lower = query_str.lower().strip()
        citations: List[CopilotCitation] = retrieved.get("citations", [])
        stats: Dict[str, Any] = retrieved.get("stats", {})

        # Check if target batch was specified but does not exist
        target_batch_requested = batch_param or rag_retriever.extract_batch_id(query_str)
        if target_batch_requested and not retrieved.get("target_batch_number"):
            missing_msg = (
                f"**Record Not Found (Zero Hallucination Policy)**:\n\n"
                f"No batch matching identifier `{target_batch_requested}` exists in the active database.\n\n"
                f"- **Searched Entities**: Batches, Coils, Inspection Lots.\n"
                f"- **Result**: Zero matching records found.\n\n"
                f"Please verify the batch number in the Products & Batches registry before querying quality records."
            )
            return CopilotResponse(
                query=query_str,
                answer=missing_msg,
                citations=[],
                grounded_stats={"requested_batch": target_batch_requested, "found": False},
                provider=gemini_client.get_fallback_provider_label("No database records found for requested batch"),
                authorized=True
            )

        # Attempt Generation via Google GenAI SDK (Gemini)
        gemini_error_msg = None
        if gemini_client.is_configured:
            gemini_text, gemini_error_msg, provider_name = gemini_client.generate_grounded_response(
                query=query_str,
                retrieved_context=retrieved
            )
            if gemini_text:
                return CopilotResponse(
                    query=query_str,
                    answer=gemini_text,
                    citations=citations,
                    grounded_stats=stats,
                    provider=provider_name,
                    authorized=True
                )

        # Deterministic Grounded RAG Synthesis with explicit provider label
        answer = self._synthesize_grounded_response(query_lower, query_str, retrieved, db)
        provider_label = gemini_client.get_fallback_provider_label(gemini_error_msg)

        return CopilotResponse(
            query=query_str,
            answer=answer,
            citations=citations,
            grounded_stats=stats,
            provider=provider_label,
            authorized=True
        )

    def process_query(
        self,
        query_str: str,
        current_user: User,
        db: Session,
        batch_param: Optional[str] = None
    ) -> CopilotResponse:
        # 1. Safety & Governance Guard
        safety_response = self.check_safety_guard(query_str)
        if safety_response:
            return safety_response

        # 2. Retrieve authorized application context via Lightweight RAG Retriever
        retrieved = rag_retriever.retrieve_context(
            query_str=query_str,
            current_user=current_user,
            db=db,
            batch_param=batch_param
        )

        # 3. Synthesize response
        return self.synthesize_from_retrieved(query_str, retrieved, db, batch_param)

    def _synthesize_grounded_response(
        self,
        query_lower: str,
        query_str: str,
        retrieved: Dict[str, Any],
        db: Session
    ) -> str:
        batch_num = retrieved.get("target_batch_number")

        # CLASS 1: "Why is a particular batch on hold?"
        if ("why" in query_lower and ("hold" in query_lower or "status" in query_lower)) or \
           ("on hold" in query_lower and batch_num) or \
           ("on the hold" in query_lower and batch_num):
            return self._synthesize_batch_hold_reason(batch_num, retrieved, db)

        # CLASS 2: "Summarize the defects in a batch."
        if ("summarize" in query_lower and "defect" in query_lower) or \
           ("defects in" in query_lower and batch_num) or \
           ("batch" in query_lower and "summary" in query_lower and batch_num):
            return self._synthesize_batch_defects_summary(batch_num, retrieved, db)

        # CLASS 3: "Which corrective actions are overdue?"
        if "overdue" in query_lower or ("corrective" in query_lower and "late" in query_lower):
            return self._synthesize_overdue_actions(retrieved, db)

        # CLASS 4: "What do our quality procedures say about this defect?"
        if "procedure" in query_lower or "sop" in query_lower or "say about" in query_lower or "standard" in query_lower:
            return self._synthesize_procedure_guidance(query_str, retrieved)

        # CLASS 5: "Draft a corrective-action plan."
        if "draft" in query_lower or "corrective-action plan" in query_lower or "capa plan" in query_lower:
            return self._synthesize_draft_capa_plan(batch_num, retrieved, db)

        # CLASS 6: "Generate a quality inspection summary."
        if "inspection summary" in query_lower or "quality summary" in query_lower or "summary" in query_lower:
            return self._synthesize_quality_inspection_summary(batch_num, retrieved, db)

        return self._synthesize_general_grounded_answer(retrieved)

    def _synthesize_batch_hold_reason(self, batch_num: Optional[str], retrieved: Dict[str, Any], db: Session) -> str:
        if not batch_num:
            return (
                "**Batch Hold Analysis**: Please specify a valid batch number (e.g., `Why is batch B-2026-104 on hold?`).\n\n"
                "You can also select from currently held batches in the Products & Batches register."
            )

        batch = db.query(Batch).filter(Batch.batch_number == batch_num).first()
        if not batch:
            return f"**Batch Record Missing**: Batch `{batch_num}` was not found in the database."

        lines = [
            f"### Quality Hold Investigation: Batch `{batch.batch_number}` [{batch.product.name}]",
            f"- **Current Disposition**: `{batch.status}`",
            f"- **Product Code**: `{batch.product.code}` | **Grade**: Hot/Cold Rolled Steel",
            f"- **Batch Size**: {batch.quantity:,} units | **Production Date**: {batch.production_date.strftime('%Y-%m-%d')}",
            ""
        ]

        if batch.status != "ON_HOLD":
            lines.append(f"**Notice**: Batch `{batch.batch_number}` is currently marked as **`{batch.status}`**, not `ON_HOLD`.")
            if batch.decision_notes:
                lines.append(f"- **Latest Decision Notes**: '{batch.decision_notes}'")
            return "\n".join(lines)

        lines.append("#### 1. Hold Trigger & Audit History")
        if batch.decision_notes:
            lines.append(f"- **Official Quarantine Note**: '{batch.decision_notes}'")
        
        decisions = db.query(BatchDecision).filter(BatchDecision.batch_id == batch.id).order_by(BatchDecision.created_at.desc()).all()
        if decisions:
            for d in decisions[:2]:
                decider = db.query(User).filter(User.id == d.decided_by_user_id).first()
                dec_name = decider.full_name if decider else f"User #{d.decided_by_user_id}"
                dec_role = decider.role if decider else ""
                lines.append(f"- **Audit Event**: Status changed to `{d.new_status}` by **{dec_name}** ({dec_role}) on {d.created_at.strftime('%Y-%m-%d %H:%M')}: *'{d.reason}'*")
        else:
            lines.append("- *No formal electronic batch decision entry recorded.*")

        lines.append("")
        lines.append("#### 2. Confirmed Defect Evidence")
        confirmed_defects = db.query(ConfirmedDefect).filter(ConfirmedDefect.batch_id == batch.id).all()
        if confirmed_defects:
            for cd in confirmed_defects:
                lines.append(
                    f"- **[DEFECT: {cd.defect_code}]** — **{cd.defect_category}** ({cd.severity} Severity) | Status: `{cd.review_status}`\n"
                    f"  *Description*: '{cd.description}'"
                )
        else:
            lines.append("- *No human-confirmed defects currently linked to this batch.*")

        lines.append("")
        lines.append("#### 3. Automated Inspection Findings")
        inspections = db.query(Inspection).filter(Inspection.batch_id == batch.id).all()
        has_cnn = False
        for insp in inspections:
            for inf in insp.inference_attempts:
                has_cnn = True
                pred_name = inf.defect_display_name or inf.defect_type
                lines.append(
                    f"- **[CNN Model Prediction - Not Human Confirmed]**: Item `{insp.item_identifier}` detected **{pred_name}** "
                    f"with {inf.confidence_score*100:.1f}% confidence."
                )
        if not has_cnn:
            lines.append("- *No automated CNN inspection scans logged for this batch.*")

        lines.append("")
        lines.append("#### 4. Blocking Corrective Actions (CAPA)")
        actions = db.query(CorrectiveAction).join(ConfirmedDefect).filter(ConfirmedDefect.batch_id == batch.id).all()
        open_actions = [a for a in actions if a.status in ["PENDING", "IN_PROGRESS"]]
        if open_actions:
            for a in open_actions:
                lines.append(f"- **[CAPA: {a.action_code}]**: '{a.title}' | Status: `{a.status}` | Target Date: {a.target_date.strftime('%Y-%m-%d')}")
        else:
            lines.append("- *No open corrective actions blocking release.*")

        lines.append("")
        lines.append("#### 5. Recommended Next Steps for Quality Manager")
        lines.append("1. Review root causes and verify completion of open CAPA items.")
        lines.append("2. Perform Before/After Reinspection on rectified steel surface areas.")
        lines.append("3. Only an authorized **Quality Manager** may release this batch after physical verification.")

        return "\n".join(lines)

    def _synthesize_batch_defects_summary(self, batch_num: Optional[str], retrieved: Dict[str, Any], db: Session) -> str:
        if not batch_num:
            return "**Batch Defect Summary**: Please indicate a target batch identifier (e.g. `Summarize the defects in batch B-2026-104`)."

        batch = db.query(Batch).filter(Batch.batch_number == batch_num).first()
        if not batch:
            return f"**Batch Not Found**: No database record exists for batch `{batch_num}`."

        confirmed = db.query(ConfirmedDefect).filter(ConfirmedDefect.batch_id == batch.id).all()
        inspections = db.query(Inspection).filter(Inspection.batch_id == batch.id).all()

        lines = [
            f"### Defect Summary: Batch `{batch.batch_number}` [{batch.product.name}]",
            f"- **Batch Status**: `{batch.status}` | **Inspections Performed**: {len(inspections)}",
            f"- **Human-Confirmed Defects**: {len(confirmed)}",
            ""
        ]

        critical = [d for d in confirmed if d.severity == "CRITICAL"]
        major = [d for d in confirmed if d.severity == "MAJOR"]
        minor = [d for d in confirmed if d.severity == "MINOR"]

        lines.append("#### Confirmed Defects (Human Verified)")
        if confirmed:
            lines.append(f"- **Breakdown**: Critical: **{len(critical)}** | Major: **{len(major)}** | Minor: **{len(minor)}**")
            lines.append("")
            for cd in confirmed:
                badge = "CRITICAL" if cd.severity == "CRITICAL" else ("MAJOR" if cd.severity == "MAJOR" else "MINOR")
                lines.append(f"- **[DEFECT: {cd.defect_code}]** ({badge}) — **{cd.defect_category}**")
                lines.append(f"  *Description*: '{cd.description}' | Review Status: `{cd.review_status}`")
        else:
            lines.append("- *Zero human-confirmed defects recorded for this batch.*")

        lines.append("")
        lines.append("#### Automated AI Detections [CNN Model Predictions - Not Human Confirmed]")
        ai_preds = []
        for insp in inspections:
            for inf in insp.inference_attempts:
                ai_preds.append((insp.item_identifier, inf.defect_display_name or inf.defect_type, inf.confidence_score))

        if ai_preds:
            for item_id, defect_name, conf in ai_preds[:5]:
                lines.append(f"- **Item `{item_id}`**: Predicted **{defect_name}** ({conf*100:.1f}% confidence) — *Pending human verification*")
            if len(ai_preds) > 5:
                lines.append(f"- *... and {len(ai_preds)-5} additional automated scan records.*")
        else:
            lines.append("- *No unconfirmed automated model predictions found.*")

        return "\n".join(lines)

    def _synthesize_overdue_actions(self, retrieved: Dict[str, Any], db: Session) -> str:
        now = datetime.utcnow()
        overdue_actions = db.query(CorrectiveAction).filter(
            CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"]),
            CorrectiveAction.target_date < now
        ).all()

        lines = [
            "### Overdue Corrective & Preventive Actions (CAPA)",
            f"- **Total Overdue Items**: **{len(overdue_actions)}**",
            f"- **Report Timestamp**: {now.strftime('%Y-%m-%d %H:%M UTC')}",
            ""
        ]

        if not overdue_actions:
            lines.append("All corrective actions are currently on-schedule! No open CAPAs have exceeded their target completion date.")
            return "\n".join(lines)

        lines.append("| CAPA Code | Title | Batch | Defect | Assignee | Due Date | Overdue By |")
        lines.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")

        for act in overdue_actions:
            assignee = db.query(User).filter(User.id == act.assigned_to_user_id).first()
            assignee_name = assignee.full_name if assignee else f"User #{act.assigned_to_user_id}"
            defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.id == act.defect_id).first()
            batch_str = defect.batch.batch_number if defect and defect.batch else "General"
            defect_str = defect.defect_category if defect else "Unspecified"
            overdue_days = (now - act.target_date).days

            lines.append(
                f"| **[CAPA: {act.action_code}]** | {act.title} | `{batch_str}` | {defect_str} | {assignee_name} | {act.target_date.strftime('%Y-%m-%d')} | **{overdue_days} days** |"
            )

        return "\n".join(lines)

    def _synthesize_procedure_guidance(self, query_str: str, retrieved: Dict[str, Any]) -> str:
        proc_excerpts = retrieved.get("procedural_excerpts", [])
        if not proc_excerpts:
            return (
                "**Standard Operating Procedures**: No specific SOP matched your query keywords.\n\n"
                "Available Quality Procedures in ForgeSight:\n"
                "- `DOC-SOP-001`: Surface Crazing Defect Procedure\n"
                "- `DOC-SOP-002`: Slag & Non-Metallic Inclusion Procedure\n"
                "- `DOC-SOP-003`: Surface Patches & Cold Scabs Procedure\n"
                "- `DOC-SOP-004`: Acid Pitting & Chemical Cavity Procedure\n"
                "- `DOC-SOP-005`: Rolled-In Scale & Mill Scale Procedure\n"
                "- `DOC-SOP-006`: Surface Scratches & Mechanical Gouges Procedure\n"
                "- `DOC-SOP-007`: Steel Batch Hold, Quarantine & Release Authority SOP"
            )

        lines = [
            "### Standard Quality Operating Procedure Excerpt",
            ""
        ]
        for excerpt in proc_excerpts:
            lines.append(excerpt)
            lines.append("\n---")

        return "\n".join(lines)

    def _synthesize_draft_capa_plan(self, batch_num: Optional[str], retrieved: Dict[str, Any], db: Session) -> str:
        lines = [
            "### Corrective & Preventive Action (CAPA) Draft Plan",
            "> [!IMPORTANT]",
            "> **DRAFT FOR HUMAN QUALITY MANAGER REVIEW ONLY**: This plan is generated for decision support under ISO 9001 / IATF 16949. It is **not approved** until authorized by the designated Quality Manager.",
            ""
        ]

        if batch_num:
            batch = db.query(Batch).filter(Batch.batch_number == batch_num).first()
            if batch:
                lines.append(f"**Target Batch**: `{batch.batch_number}` [{batch.product.name}] | **Current Status**: `{batch.status}`")
                defects = db.query(ConfirmedDefect).filter(ConfirmedDefect.batch_id == batch.id).all()
                if defects:
                    lines.append(f"**Associated Defects**: {', '.join(d.defect_category for d in defects)}")
                lines.append("")

        lines.extend([
            "#### 1. Immediate Containment (D3)",
            "- Quarantine target batch and prevent transfer to downstream finishing/shipping lines.",
            "- Physically tag affected steel coils/plates with high-visibility red quarantine identifiers.",
            "- Conduct boundary sweep of consecutive production heats (prior 2 heats and subsequent heat).",
            "",
            "#### 2. Root Cause Analysis (D4 - 5-Why Methodology)",
            "- **Mechanical/Thermal Stress**: Inspect roll alignment, bearing wear, and cooling spray nozzle blockage.",
            "- **Deoxidation & Chemistry**: Review ladle furnace deoxidation reports and argon shrouding pressure logs.",
            "- **Mill Hygiene**: Check high-pressure descaling header pressures (target: >= 180 bar).",
            "",
            "#### 3. Permanent Corrective Actions (D5)",
            "- Replace worn work rolls and dress intermediate roll stands.",
            "- Recalibrate descaling spray nozzles and descale header filters.",
            "- Re-tune cooling water flow rates to eliminate thermal shock cycling.",
            "",
            "#### 4. Verification & Reinspection Criteria (D6)",
            "- Perform high-resolution surface scan and **Before vs After Image Comparison** on rectified coils.",
            "- Verify surface roughness (Ra <= 1.6 µm) and zero microcracks via magnetic particle testing.",
            "- Formal reinspection sign-off required by permitted Quality Inspector.",
            "",
            "#### 5. Sign-off & Authorization",
            "- **Prepared by**: ForgeSight AI Quality Copilot (Draft Assistant)",
            "- **Reviewer Required**: Assigned Quality Manager",
            "- **Action Status**: Pending Human Review"
        ])

        return "\n".join(lines)

    def _synthesize_quality_inspection_summary(self, batch_num: Optional[str], retrieved: Dict[str, Any], db: Session) -> str:
        now = datetime.utcnow()
        total_batches = db.query(Batch).count()
        held_batches = db.query(Batch).filter(Batch.status == "ON_HOLD").count()
        released_batches = db.query(Batch).filter(Batch.status == "RELEASED").count()
        total_inspections = db.query(Inspection).count()
        total_defects = db.query(ConfirmedDefect).count()
        open_capas = db.query(CorrectiveAction).filter(CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"])).count()
        overdue_capas = db.query(CorrectiveAction).filter(
            CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"]),
            CorrectiveAction.target_date < now
        ).count()

        lines = [
            "### ForgeSight Quality Inspection & Operations Summary",
            f"- **Report Date**: {now.strftime('%Y-%m-%d %H:%M UTC')}",
            f"- **Plant Domain**: Hot-Rolled & Cold-Rolled Steel Flat Products",
            "",
            "#### Plant Quality KPI Dashboard",
            f"- **Total Batches Tracked**: **{total_batches}**",
            f"- **Batches On Hold**: **{held_batches}** (Quarantine Rate: {held_batches/max(total_batches, 1)*100:.1f}%)",
            f"- **Batches Released**: **{released_batches}**",
            f"- **Total Scanned Inspections**: **{total_inspections}**",
            f"- **Human-Confirmed Defect Log**: **{total_defects}**",
            f"- **Active Corrective Actions (CAPA)**: **{open_capas}** ({overdue_capas} overdue)",
            ""
        ]

        if batch_num:
            lines.append(f"#### Specific Focus: Batch `{batch_num}`")
            lines.append(self._synthesize_batch_defects_summary(batch_num, retrieved, db))

        return "\n".join(lines)

    def _synthesize_general_grounded_answer(self, retrieved: Dict[str, Any]) -> str:
        facts = retrieved.get("confirmed_facts", [])
        preds = retrieved.get("cnn_predictions", [])
        proc = retrieved.get("procedural_excerpts", [])

        lines = ["### ForgeSight Grounded Quality Intelligence", ""]
        if facts:
            lines.append("#### Verified Application Records:")
            for f in facts[:5]:
                lines.append(f"- {f}")
            lines.append("")

        if preds:
            lines.append("#### Automated AI Scan Detections [CNN Model Predictions - Not Human Confirmed]:")
            for p in preds[:5]:
                lines.append(f"- {p}")
            lines.append("")

        if proc:
            lines.append("#### Relevant Standard Operating Procedures:")
            for p in proc:
                lines.append(f"{p[:300]}...")
            lines.append("")

        if not facts and not preds and not proc:
            lines.append("No specific quality records matched your query terms. Please ask about a specific batch, defect type, or corrective action.")

        return "\n".join(lines)

copilot_engine = QualityCopilotEngine()
