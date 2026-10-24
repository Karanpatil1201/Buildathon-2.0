import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models import User, Batch, Inspection, ConfirmedDefect, CorrectiveAction, InferenceAttempt, HumanReview
from app.schemas import CopilotResponse, CopilotCitation
from app.config import settings

class QualityCopilotEngine:
    def __init__(self):
        self.provider = settings.GENAI_PROVIDER

    def process_query(self, query_str: str, current_user: User, db: Session, batch_param: Optional[str] = None) -> CopilotResponse:
        query_lower = query_str.lower().strip()
        citations: List[CopilotCitation] = []
        grounded_stats: Dict[str, Any] = {}

        # 1. Authority Guard: Block autonomous state mutation attempts
        if any(w in query_lower for w in ["certify", "override defect", "close defect", "approve batch"]) or \
           ("release" in query_lower and any(b in query_lower for b in ["batch", "it", "product", "hold"])):
            return CopilotResponse(
                query=query_str,
                answer=(
                    "**Safety & Compliance Guard Triggered**: GenAI is strictly a decision-support assistant and "
                    "is **prohibited from autonomously certifying product quality, releasing batches, or closing defects**. "
                    "Batch disposition requires physical human review and authorization by an assigned Quality Manager per standard ISO 9001 quality assurance protocols."
                ),
                citations=[],
                grounded_stats={"safety_guard_triggered": True, "policy": "Human-in-the-loop mandatory"},
                provider="ForgeSight Grounded Governance Engine",
                authorized=True
            )

        # 2. Extract potential batch identifier (e.g. B-2026-104, B-104, B-UNKNOWN-999)
        extracted_batch = batch_param
        if not extracted_batch:
            # Check for "batch <id>"
            m_after_batch = re.search(r"\bbatch\s+([a-zA-Z0-9_\-]+)\b", query_str, re.IGNORECASE)
            if m_after_batch and m_after_batch.group(1).lower() not in ["summary", "status", "report", "the"]:
                extracted_batch = m_after_batch.group(1).upper()
            else:
                m_b = re.search(r"\b(B[-\s]?\d+[-\w]*)\b", query_str, re.IGNORECASE)
                if m_b and m_b.group(1).lower() != "batch":
                    extracted_batch = m_b.group(1).upper()

        # Check for specific intents:
        # A. Batch Summary Intent
        if ("summarize" in query_lower and "batch" in query_lower) or extracted_batch:
            return self._handle_batch_summary(extracted_batch, query_str, db)

        # B. Overdue Actions Intent
        if "overdue" in query_lower or ("corrective" in query_lower and "action" in query_lower and "late" in query_lower):
            return self._handle_overdue_actions(query_str, db)

        # C. Similar Defect History
        if "similar" in query_lower or "previously recorded" in query_lower or "recurring" in query_lower or "history" in query_lower:
            return self._handle_similar_defects(query_str, db)

        # D. What Needs Attention Today / Triage
        if "attention" in query_lower or "today" in query_lower or "triage" in query_lower or "urgent" in query_lower:
            return self._handle_triage_attention(query_str, db)

        # E. Draft Quality Report
        if "draft" in query_lower or "report" in query_lower:
            return self._handle_draft_report(query_str, db)

        # Default fallback: Comprehensive Grounded Plant Status
        return self._handle_general_status(query_str, db)

    def _handle_batch_summary(self, batch_identifier: Optional[str], query_str: str, db: Session) -> CopilotResponse:
        if not batch_identifier:
            # Pick latest batch
            latest_b = db.query(Batch).order_by(Batch.created_at.desc()).first()
            if not latest_b:
                return CopilotResponse(
                    query=query_str,
                    answer="No batches have been registered in the database yet. Please register a product and batch first.",
                    citations=[],
                    grounded_stats={},
                    provider="grounded_deterministic_synthesizer"
                )
            batch_identifier = latest_b.batch_number

        # Query batch
        batch = db.query(Batch).filter(
            or_(
                Batch.batch_number.ilike(f"%{batch_identifier}%"),
                Batch.batch_number == batch_identifier
            )
        ).first()

        # If not found directly, extract digits (e.g. '104' from 'B-104')
        if not batch:
            digits = re.findall(r"\d+", batch_identifier)
            if digits:
                num_sub = digits[-1]
                batch = db.query(Batch).filter(Batch.batch_number.ilike(f"%{num_sub}%")).first()

        if not batch:
            return CopilotResponse(
                query=query_str,
                answer=(
                    f"**Record Not Found**: No batch matching identifier `'{batch_identifier}'` exists in the database. "
                    "Evidence-based quality copilot cannot summarize non-existent records. "
                    "Please check the batch number in the Products & Batches registry."
                ),
                citations=[],
                grounded_stats={"requested_identifier": batch_identifier, "found": False},
                provider="grounded_deterministic_synthesizer"
            )

        citations = [
            CopilotCitation(record_type="BATCH", record_id=batch.batch_number, label=f"Batch {batch.batch_number} ({batch.product.name})")
        ]

        # Calculate exact counts
        inspections = db.query(Inspection).filter(Inspection.batch_id == batch.id).all()
        distinct_items = len(set(i.item_identifier for i in inspections))
        confirmed_defects = db.query(ConfirmedDefect).filter(ConfirmedDefect.batch_id == batch.id).all()
        
        # Distinguish machine predictions from confirmed defects
        unreviewed_ai_defects = 0
        for insp in inspections:
            if insp.status == "INFERENCE_COMPLETED":
                latest_inf = insp.inference_attempts[0] if insp.inference_attempts else None
                if latest_inf and latest_inf.raw_prediction == "DEFECTIVE":
                    unreviewed_ai_defects += 1

        defect_codes = []
        for cd in confirmed_defects:
            citations.append(CopilotCitation(record_type="DEFECT", record_id=cd.defect_code, label=f"{cd.defect_code} ({cd.defect_category} - {cd.severity})"))
            defect_codes.append(f"`[{cd.defect_code}]` ({cd.defect_category}, Severity: {cd.severity})")

        # Open actions for this batch
        actions = (
            db.query(CorrectiveAction)
            .join(ConfirmedDefect)
            .filter(ConfirmedDefect.batch_id == batch.id)
            .all()
        )
        action_codes = []
        now = datetime.utcnow()
        overdue_count = 0
        for act in actions:
            is_od = act.target_date < now and act.status in ["PENDING", "IN_PROGRESS"]
            if is_od:
                overdue_count += 1
            citations.append(CopilotCitation(record_type="ACTION", record_id=act.action_code, label=f"{act.action_code}: {act.title}"))
            action_codes.append(f"`[{act.action_code}]` {act.title} (Status: {act.status}{', OVERDUE' if is_od else ''})")

        defect_rate = (len(confirmed_defects) / distinct_items * 100) if distinct_items > 0 else 0.0

        stats = {
            "batch_number": batch.batch_number,
            "product": batch.product.name,
            "batch_status": batch.status,
            "total_inspected_items": distinct_items,
            "confirmed_defects_count": len(confirmed_defects),
            "unreviewed_ai_flagged": unreviewed_ai_defects,
            "defect_rate_pct": round(defect_rate, 1),
            "corrective_actions_count": len(actions),
            "overdue_actions_count": overdue_count
        }

        narrative = (
            f"### Grounded Quality Summary: Batch `[{batch.batch_number}]`\n\n"
            f"- **Product**: `{batch.product.code}` — **{batch.product.name}**\n"
            f"- **Batch Status**: **{batch.status}** (Registered Quantity: {batch.quantity} units)\n"
            f"- **Inspected Items**: **{distinct_items}** distinct components evaluated\n"
            f"- **Confirmed Defects**: **{len(confirmed_defects)}** (Defect Rate: **{defect_rate:.1f}%**)\n"
            f"- **Unreviewed AI Suggestions**: **{unreviewed_ai_defects}** item(s) flagged by ML awaiting human sign-off\n\n"
        )

        if confirmed_defects:
            narrative += "**Confirmed Defect Findings**:\n" + "\n".join([f"- {d}" for d in defect_codes]) + "\n\n"
        else:
            narrative += "No defects have been confirmed for this batch by human reviewers.\n\n"

        if actions:
            narrative += f"**Linked Corrective Actions ({len(actions)} total, {overdue_count} overdue)**:\n" + "\n".join([f"- {a}" for a in action_codes]) + "\n\n"
        else:
            narrative += "No corrective actions are currently open for this batch.\n\n"

        narrative += (
            f"> **Quality Recommendation**: With batch status currently set to `{batch.status}` "
            f"and {unreviewed_ai_defects} unreviewed AI prediction(s), complete all pending human reviews "
            f"before submitting a formal batch hold/release decision."
        )

        return CopilotResponse(
            query=query_str,
            answer=narrative,
            citations=citations,
            grounded_stats=stats,
            provider="grounded_deterministic_synthesizer"
        )

    def _handle_overdue_actions(self, query_str: str, db: Session) -> CopilotResponse:
        now = datetime.utcnow()
        overdue_actions = (
            db.query(CorrectiveAction)
            .filter(
                CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"]),
                CorrectiveAction.target_date < now
            )
            .all()
        )

        citations = []
        for act in overdue_actions:
            citations.append(CopilotCitation(record_type="ACTION", record_id=act.action_code, label=f"{act.action_code}: {act.title}"))

        if not overdue_actions:
            return CopilotResponse(
                query=query_str,
                answer=(
                    "### Overdue Corrective Actions Audit\n\n"
                    "Good news! **Zero (0) corrective actions are currently overdue** in the system. "
                    "All remediation tasks are either within their designated SLA target dates or already completed."
                ),
                citations=[],
                grounded_stats={"overdue_count": 0},
                provider="grounded_deterministic_synthesizer"
            )

        items_md = []
        for act in overdue_actions:
            days_late = (now - act.target_date).days
            owner_name = act.assigned_to.full_name if act.assigned_to else "Unassigned"
            items_md.append(
                f"- `[{act.action_code}]` **{act.title}**\n"
                f"  - Linked Defect: `[{act.defect.defect_code}]` ({act.defect.defect_category})\n"
                f"  - Owner: **{owner_name}** | Target Date: {act.target_date.strftime('%Y-%m-%d')} (**{days_late} days overdue**)\n"
                f"  - Status: `{act.status}`"
            )

        narrative = (
            f"### Overdue Corrective Actions Audit ({len(overdue_actions)} Total)\n\n"
            f"The following {len(overdue_actions)} corrective action(s) have passed their committed resolution target dates:\n\n"
            + "\n".join(items_md) + "\n\n"
            f"> **Urgent Action**: Production supervisors must follow up with assigned action owners to resolve or request SLA extensions."
        )

        return CopilotResponse(
            query=query_str,
            answer=narrative,
            citations=citations,
            grounded_stats={"overdue_count": len(overdue_actions)},
            provider="grounded_deterministic_synthesizer"
        )

    def _handle_similar_defects(self, query_str: str, db: Session) -> CopilotResponse:
        defects = db.query(ConfirmedDefect).order_by(ConfirmedDefect.created_at.desc()).limit(8).all()
        citations = []
        for d in defects:
            citations.append(CopilotCitation(record_type="DEFECT", record_id=d.defect_code, label=f"{d.defect_code}: {d.defect_category} ({d.severity})"))

        if not defects:
            return CopilotResponse(
                query=query_str,
                answer="No confirmed defect history exists in the database to compare against.",
                citations=[],
                grounded_stats={"historical_defects": 0},
                provider="grounded_deterministic_synthesizer"
            )

        # Categorize
        cat_counts = {}
        for d in defects:
            cat_counts[d.defect_category] = cat_counts.get(d.defect_category, 0) + 1

        top_cat = max(cat_counts.items(), key=lambda x: x[1])

        narrative = (
            f"### Historical Defect Similarity & Recurrence Analysis\n\n"
            f"Cross-batch analysis of the last {len(defects)} confirmed defects shows **{top_cat[0]}** is the most frequent defect pattern ({top_cat[1]} occurrences):\n\n"
        )
        for d in defects:
            narrative += (
                f"- `[{d.defect_code}]` (Batch `[{d.batch.batch_number}]`): **{d.defect_category}** — Severity: **{d.severity}**\n"
                f"  - Notes: {d.description} | Status: `{d.review_status}`\n"
            )

        narrative += (
            f"\n> **Pattern Insight**: Crazing microcracks and surface inclusions are recurring in hot-rolled steel strip batches. "
            f"Ensure mould degassing temperatures and sand moisture levels are verified."
        )

        return CopilotResponse(
            query=query_str,
            answer=narrative,
            citations=citations,
            grounded_stats={"analyzed_count": len(defects), "category_distribution": cat_counts},
            provider="grounded_deterministic_synthesizer"
        )

    def _handle_triage_attention(self, query_str: str, db: Session) -> CopilotResponse:
        pending_reviews = db.query(Inspection).filter(Inspection.status.in_(["INFERENCE_COMPLETED", "UNDER_REVIEW"])).count()
        overdue_actions = (
            db.query(CorrectiveAction)
            .filter(CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"]), CorrectiveAction.target_date < datetime.utcnow())
            .count()
        )
        batches_on_hold = db.query(Batch).filter(Batch.status == "ON_HOLD").count()

        narrative = (
            "### Plant Quality Attention Dashboard — Today's Priorities\n\n"
            f"1. **Inspection Review Queue**: **{pending_reviews}** item(s) have completed ML inference and require human review.\n"
            f"2. **Overdue CAPA Items**: **{overdue_actions}** corrective action(s) require escalation.\n"
            f"3. **Batches On Hold**: **{batches_on_hold}** batch(es) are currently held pending quality decisions.\n\n"
            "Use the **Evidence-Driven Review Prioritization** screen to review high-uncertainty and critical defect items first."
        )

        return CopilotResponse(
            query=query_str,
            answer=narrative,
            citations=[],
            grounded_stats={
                "pending_reviews": pending_reviews,
                "overdue_actions": overdue_actions,
                "batches_on_hold": batches_on_hold
            },
            provider="grounded_deterministic_synthesizer"
        )

    def _handle_draft_report(self, query_str: str, db: Session) -> CopilotResponse:
        total_items = db.query(func.count(func.distinct(Inspection.item_identifier))).scalar() or 0
        total_defects = db.query(func.count(ConfirmedDefect.id)).scalar() or 0
        total_actions = db.query(func.count(CorrectiveAction.id)).scalar() or 0
        completed_actions = db.query(func.count(CorrectiveAction.id)).filter(CorrectiveAction.status == "COMPLETED").scalar() or 0
        batches = db.query(Batch).all()

        rate = (total_defects / total_items * 100) if total_items > 0 else 0.0

        citations = []
        for b in batches[:5]:
            citations.append(CopilotCitation(record_type="BATCH", record_id=b.batch_number, label=f"Batch {b.batch_number}"))

        narrative = (
            "### Executive Quality Inspection & Defect Remediation Report\n\n"
            f"**Audit Period**: Current Production Cycle ({datetime.utcnow().strftime('%B %Y')})\n\n"
            "#### 1. Key Performance Indicators\n"
            f"- **Total Components Inspected**: {total_items} distinct units\n"
            f"- **Confirmed Defective Components**: {total_defects} units\n"
            f"- **Overall Plant Defect Rate**: **{rate:.2f}%**\n"
            f"- **Corrective Actions Remediated**: {completed_actions} of {total_actions} ({((completed_actions/total_actions*100) if total_actions > 0 else 100):.1f}% resolution rate)\n\n"
            "#### 2. Batch Dispositions Summary\n"
        )
        for b in batches:
            narrative += f"- `[{b.batch_number}]` ({b.product.name}): Status **{b.status}**\n"

        narrative += (
            "\n#### 3. Continuous Improvement Directive\n"
            "All batches with recurring blowhole or crack defects remain under active CAPA monitoring. "
            "Reinspections must be logged following tooling rework."
        )

        return CopilotResponse(
            query=query_str,
            answer=narrative,
            citations=citations,
            grounded_stats={
                "total_items": total_items,
                "total_defects": total_defects,
                "overall_defect_rate": round(rate, 2),
                "total_actions": total_actions,
                "completed_actions": completed_actions
            },
            provider="grounded_deterministic_synthesizer"
        )

    def _handle_general_status(self, query_str: str, db: Session) -> CopilotResponse:
        total_items = db.query(func.count(func.distinct(Inspection.item_identifier))).scalar() or 0
        pending = db.query(Inspection).filter(Inspection.status.in_(["INFERENCE_COMPLETED", "UNDER_REVIEW"])).count()
        defects = db.query(ConfirmedDefect).count()

        answer = (
            "### ForgeSight AI Grounded Quality Copilot\n\n"
            f"I have direct access to your plant's inspection, defect, and CAPA database. "
            f"Currently tracking **{total_items}** inspected items, **{pending}** pending reviews, and **{defects}** confirmed defects.\n\n"
            "**Supported Questions**:\n"
            "- *'Summarize batch B-2026-104'*\n"
            "- *'Which corrective actions are overdue?'*\n"
            "- *'Have we previously recorded a similar defect?'*\n"
            "- *'What needs attention today?'*\n"
            "- *'Draft a quality report for the selected period'*"
        )
        return CopilotResponse(
            query=query_str,
            answer=answer,
            citations=[],
            grounded_stats={"total_items": total_items, "pending_reviews": pending, "confirmed_defects": defects},
            provider="grounded_deterministic_synthesizer"
        )

copilot_engine = QualityCopilotEngine()
