import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import User, Batch, BatchDecision, Inspection, ConfirmedDefect, CorrectiveAction, InferenceAttempt, HumanReview
from app.schemas import CopilotCitation
from app.rbac import (
    has_permission,
    PERM_INSPECTION_READ, PERM_INSPECTION_READ_ALL,
    PERM_DEFECT_READ, PERM_CAPA_READ, PERM_BATCH_READ
)

PROCEDURES_DIR = Path(__file__).parent / "procedures"

class LightweightRAGRetriever:
    """
    Lightweight, deterministic RAG retrieval service for ForgeSight AI / Steel-IQ.
    
    - Retrieves authorized structured facts from application database (Batches, Confirmed Defects, CAPAs).
    - Queries CNN model predictions with explicit unconfirmed labels.
    - Matches local quality Standard Operating Procedures (SOPs) via in-memory keyword search.
    - Strictly enforces user role permissions and object-level authorization before retrieval.
    - Detects and reports missing records without hallucinating.
    """
    def __init__(self, procedures_path: Optional[Path] = None):
        self.procedures_path = procedures_path or PROCEDURES_DIR
        self._doc_cache: Dict[str, Dict[str, str]] = {}
        self._load_procedures()

    def _load_procedures(self):
        """Loads all procedural Markdown documents into an in-memory keyword index."""
        if not self.procedures_path.exists():
            return
        for file in self.procedures_path.glob("*.md"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                doc_id_match = re.search(r"\*\*Document ID\*\*:\s*([A-Za-z0-9_\-]+)", content)
                doc_id = doc_id_match.group(1) if doc_id_match else file.stem
                title_line = content.split("\n")[0].replace("#", "").strip()
                self._doc_cache[doc_id] = {
                    "doc_id": doc_id,
                    "filename": file.name,
                    "title": title_line,
                    "content": content
                }
            except Exception as e:
                print(f"[RAG Retriever] Error loading procedure {file}: {e}")

    def search_procedures(self, query: str, top_k: int = 2) -> List[Dict[str, str]]:
        """Simple, deterministic keyword-based procedure retrieval."""
        q_lower = query.lower()
        scored: List[tuple] = []

        keywords_map = {
            "crazing": ["crazing", "microcrack", "fissure", "thermal stress", "cooling spray"],
            "inclusion": ["inclusion", "slag", "oxide", "deoxidation", "shroud", "argon"],
            "patches": ["patch", "scab", "peel", "roughness", "friction", "guide shoe"],
            "pitting": ["pitted", "pitting", "cavity", "acid", "pickling", "rinse"],
            "scale": ["scale", "rolled-in", "oxidation", "descaling", "descaler", "nozzle"],
            "scratches": ["scratch", "abrasion", "groove", "wrapper", "mandrel", "table roller"],
            "hold": ["hold", "quarantine", "release", "authority", "protocol", "disposition"],
            "release": ["release", "quarantine", "hold", "authority"]
        }

        for doc_id, doc in self._doc_cache.items():
            score = 0
            doc_text = (doc["title"] + " " + doc["content"]).lower()
            
            # Direct query word matches
            words = [w for w in re.findall(r"\w+", q_lower) if len(w) > 3]
            for w in words:
                if w in doc_text:
                    score += 2

            # Semantic keyword matches
            for key, related in keywords_map.items():
                if key in q_lower:
                    for r in related:
                        if r in doc_text:
                            score += 3

            if score > 0:
                scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]

    STOP_WORDS = {
        "is", "are", "was", "were", "has", "have", "had", "will", "would", "the", "a", "an",
        "on", "in", "at", "for", "of", "to", "from", "with", "summary", "status", "report",
        "hold", "held", "plan", "records", "defect", "defects", "inspection", "inspections",
        "quality", "review", "details", "data", "info", "information", "about", "this", "that",
        "particular", "which", "what", "where", "why", "how", "when", "all", "any"
    }

    def extract_batch_id(self, query_str: str) -> Optional[str]:
        """
        Robustly extracts batch identifiers (e.g. B-2026-101, B-2026-104, B-101, B-UNKNOWN-999).
        Guarantees that words like 'is', 'the', 'on', 'hold' are NEVER extracted as batch IDs.
        """
        # 1. High-confidence explicit batch pattern (B-YYYY-NNN or B-NNN or B-ALPHANUM)
        m = re.search(r"\b(B-\d{4}-\d+|B-[A-Za-z0-9_\-]+|B\d{3,})\b", query_str, re.IGNORECASE)
        if m:
            candidate = m.group(1).upper()
            if candidate.lower() not in self.STOP_WORDS:
                return candidate

        # 2. Check for 'batch <id>' where <id> contains digits or hyphens and is not a stop word
        m_after_batch = re.search(r"\bbatch\s+([a-zA-Z0-9_\-]+)\b", query_str, re.IGNORECASE)
        if m_after_batch:
            candidate = m_after_batch.group(1).upper()
            if candidate.lower() not in self.STOP_WORDS and any(c.isdigit() or c == "-" for c in candidate):
                return candidate

        # 3. Check for standalone B-digits (e.g. B-101)
        m_b = re.search(r"\b(B[-\s]?\d+)\b", query_str, re.IGNORECASE)
        if m_b:
            candidate = m_b.group(1).replace(" ", "-").upper()
            if candidate.lower() not in self.STOP_WORDS:
                return candidate

        return None

    def extract_defect_id(self, query_str: str) -> Optional[str]:
        m = re.search(r"\b(DEF[-\s]?\d+)\b", query_str, re.IGNORECASE)
        return m.group(1).replace(" ", "-").upper() if m else None

    def extract_capa_id(self, query_str: str) -> Optional[str]:
        m = re.search(r"\b(CAPA[-\s]?\d+)\b", query_str, re.IGNORECASE)
        return m.group(1).replace(" ", "-").upper() if m else None

    def retrieve_context(
        self,
        query_str: str,
        current_user: User,
        db: Session,
        batch_param: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gathers relevant, permission-filtered evidence from the application database
        and procedural quality documents.
        """
        now = datetime.utcnow()
        citations: List[CopilotCitation] = []
        confirmed_facts: List[str] = []
        cnn_predictions: List[str] = []
        procedural_excerpts: List[str] = []
        missing_evidence: List[str] = []

        batch_id_str = batch_param or self.extract_batch_id(query_str)

        # 1. Product & Batch Details (Check PERM_BATCH_READ)
        target_batch = None
        if not has_permission(current_user.role, PERM_BATCH_READ):
            missing_evidence.append(f"Access Denied: User role '{current_user.role}' lacks permission to read batch records.")
        elif batch_id_str:
            target_batch = db.query(Batch).filter(
                or_(
                    Batch.batch_number == batch_id_str,
                    Batch.batch_number.ilike(f"%{batch_id_str}%")
                )
            ).first()

            if not target_batch:
                digits = re.findall(r"\d+", batch_id_str)
                if digits:
                    target_batch = db.query(Batch).filter(Batch.batch_number.ilike(f"%{digits[-1]}%")).first()

            if target_batch:
                citations.append(CopilotCitation(
                    record_type="BATCH",
                    record_id=target_batch.batch_number,
                    label=f"Batch {target_batch.batch_number} ({target_batch.product.name})"
                ))
                confirmed_facts.append(
                    f"[CONFIRMED BATCH RECORD]: Batch '{target_batch.batch_number}' | Product: '{target_batch.product.name}' ({target_batch.product.code}) | "
                    f"Status: {target_batch.status} | Quantity: {target_batch.quantity} units | "
                    f"Production Date: {target_batch.production_date.strftime('%Y-%m-%d')}."
                )

                if target_batch.decision_notes:
                    confirmed_facts.append(f"[BATCH DECISION NOTES]: {target_batch.decision_notes}")

                # Query historical decisions
                decisions = db.query(BatchDecision).filter(BatchDecision.batch_id == target_batch.id).order_by(BatchDecision.created_at.desc()).all()
                for dec in decisions:
                    decider = db.query(User).filter(User.id == dec.decided_by_user_id).first()
                    decider_name = decider.full_name if decider else f"User #{dec.decided_by_user_id}"
                    confirmed_facts.append(
                        f"[BATCH AUDIT HISTORY]: Status changed to '{dec.new_status}' by {decider_name} on {dec.created_at.strftime('%Y-%m-%d %H:%M')}. "
                        f"Reason: \"{dec.reason}\""
                    )
            else:
                missing_evidence.append(f"Batch identifier '{batch_id_str}' was searched but no matching record exists in the database.")

        # 2. Defect Records (Human-Confirmed, Check PERM_DEFECT_READ)
        confirmed_defects = []
        if not has_permission(current_user.role, PERM_DEFECT_READ):
            missing_evidence.append(f"Access Denied: User role '{current_user.role}' lacks permission to read defect records.")
        else:
            defects_query = db.query(ConfirmedDefect)
            if target_batch:
                defects_query = defects_query.filter(ConfirmedDefect.batch_id == target_batch.id)

            confirmed_defects = defects_query.all()
            for cd in confirmed_defects:
                citations.append(CopilotCitation(
                    record_type="DEFECT",
                    record_id=cd.defect_code,
                    label=f"Defect {cd.defect_code}: {cd.defect_category} ({cd.severity})"
                ))
                confirmed_facts.append(
                    f"[HUMAN-CONFIRMED DEFECT {cd.defect_code}]: Category: {cd.defect_category} | Severity: {cd.severity} | "
                    f"Status: {cd.review_status} | Description: \"{cd.description}\" | "
                    f"Batch: {cd.batch.batch_number if cd.batch else 'N/A'} | Logged: {cd.created_at.strftime('%Y-%m-%d')}."
                )

        # 3. CNN Model Predictions (Check PERM_INSPECTION_READ and isolate operator to own inspections)
        inspections = []
        if not has_permission(current_user.role, PERM_INSPECTION_READ):
            missing_evidence.append(f"Access Denied: User role '{current_user.role}' lacks permission to read inspection records.")
        else:
            insp_query = db.query(Inspection)
            # Record-level authorization check: operators only see their own authored inspections
            if not has_permission(current_user.role, PERM_INSPECTION_READ_ALL):
                insp_query = insp_query.filter(Inspection.inspector_id == current_user.id)

            if target_batch:
                insp_query = insp_query.filter(Inspection.batch_id == target_batch.id)
            
            inspections = insp_query.limit(20).all()
            for insp in inspections:
                if insp.inference_attempts:
                    latest_inf = insp.inference_attempts[0]
                    cnn_predictions.append(
                        f"[CNN MODEL PREDICTION - NOT HUMAN CONFIRMED]: Item '{insp.item_identifier}' | "
                        f"Model: {latest_inf.model_name} | Raw Prediction: {latest_inf.raw_prediction} | "
                        f"Detected Defect: {latest_inf.defect_display_name or latest_inf.defect_type} | "
                        f"Confidence: {latest_inf.confidence_score * 100:.1f}% | "
                        f"Inspection Status: {insp.status}."
                    )

        # 4. Corrective Actions (CAPA, Check PERM_CAPA_READ)
        actions = []
        overdue_count = 0
        if not has_permission(current_user.role, PERM_CAPA_READ):
            missing_evidence.append(f"Access Denied: User role '{current_user.role}' lacks permission to read CAPA records.")
        else:
            actions_query = db.query(CorrectiveAction)
            if target_batch:
                actions_query = actions_query.join(ConfirmedDefect).filter(ConfirmedDefect.batch_id == target_batch.id)
            
            actions = actions_query.all()
            for act in actions:
                is_overdue = (act.target_date < now) and (act.status in ["PENDING", "IN_PROGRESS"])
                if is_overdue:
                    overdue_count += 1
                citations.append(CopilotCitation(
                    record_type="ACTION",
                    record_id=act.action_code,
                    label=f"CAPA {act.action_code}: {act.title}"
                ))
                assignee = db.query(User).filter(User.id == act.assigned_to_user_id).first()
                assignee_name = assignee.full_name if assignee else f"User #{act.assigned_to_user_id}"
                confirmed_facts.append(
                    f"[CORRECTIVE ACTION {act.action_code}]: Title: \"{act.title}\" | Status: {act.status} | "
                    f"Assigned Owner: {assignee_name} | Target Date: {act.target_date.strftime('%Y-%m-%d')} "
                    f"({'*** OVERDUE ***' if is_overdue else 'ON-SCHEDULE'}) | Description: \"{act.description}\"."
                )

        # 5. Quality Procedural Documents (Local RAG keyword retrieval)
        matched_docs = self.search_procedures(query_str, top_k=2)
        for doc in matched_docs:
            citations.append(CopilotCitation(
                record_type="PROCEDURE",
                record_id=doc["doc_id"],
                label=f"Procedure: {doc['title']}"
            ))
            procedural_excerpts.append(
                f"[QUALITY OPERATING PROCEDURE {doc['doc_id']} - {doc['title']}]:\n{doc['content']}"
            )

        return {
            "query": query_str,
            "target_batch_number": target_batch.batch_number if target_batch else None,
            "confirmed_facts": confirmed_facts,
            "cnn_predictions": cnn_predictions,
            "procedural_excerpts": procedural_excerpts,
            "missing_evidence": missing_evidence,
            "citations": citations,
            "stats": {
                "batch_number": target_batch.batch_number if target_batch else None,
                "confirmed_defects_count": len(confirmed_defects),
                "inspections_count": len(inspections),
                "actions_count": len(actions),
                "overdue_count": overdue_count,
                "overdue_actions_count": overdue_count,
                "procedures_matched_count": len(matched_docs)
            }
        }

rag_retriever = LightweightRAGRetriever()
