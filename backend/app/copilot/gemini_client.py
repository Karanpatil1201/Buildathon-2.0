import logging
from typing import Dict, Any, Optional, Tuple
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are ForgeSight AI Quality Copilot, an expert metallurgical quality assistant for a steel manufacturing plant (Hot-Rolled & Cold-Rolled coil and plate lines).
You assist Quality Inspectors and Quality Managers with defect diagnostics, batch status, standard operating procedures (SOPs), and corrective-action drafts.

CRITICAL OPERATIONAL RULES:
1. STRICT GROUNDING: You MUST base your answers ONLY on the provided RETRIEVED CONTEXT (Batches, Confirmed Defects, CNN Model Predictions, Corrective Actions, and Standard Operating Procedures).
2. DISTINGUISH FACTS VS PREDICTIONS: Clearly distinguish human-confirmed defects from CNN model predictions. Label model predictions as "[CNN Model Prediction - Not Human Confirmed]".
3. NO FABRICATION: If the requested information or batch records are missing or not in the retrieved context, explicitly state: "Required quality records are unavailable in the system database for this query." Do NOT fabricate batch numbers, defect counts, or procedures.
4. SAFETY & COMPLIANCE GUARD: You are strictly an advisory decision-support assistant. You are PROHIBITED from autonomously certifying product quality, releasing batches, closing defects, or modifying compliance states. All corrective action plans are DRAFTS for authorized human review (ISO 9001 / IATF 16949).
5. CITATIONS: Reference source record IDs (e.g., [BATCH: B-2026-104], [DEFECT: DEF-001], [CAPA: CAPA-001], [PROCEDURE: DOC-SOP-001]) whenever citing facts.
"""

class GeminiCopilotClient:
    def __init__(self):
        self._api_key = (settings.GEMINI_API_KEY or "").strip()
        self._client = None
        self._init_client()

    def _init_client(self):
        if not self._api_key:
            logger.info("[Gemini Client] GEMINI_API_KEY not configured. Falling back to grounded deterministic RAG.")
            return

        try:
            from google import genai
            self._client = genai.Client(api_key=self._api_key)
            logger.info("[Gemini Client] Google GenAI SDK client initialized.")
        except Exception as e:
            logger.warning(f"[Gemini Client] Failed to initialize Google GenAI SDK: {e}")
            self._client = None

    @property
    def is_available(self) -> bool:
        return self._client is not None and bool(self._api_key)

    def generate_grounded_response(
        self,
        query: str,
        retrieved_context: Dict[str, Any]
    ) -> Tuple[Optional[str], Optional[str], str]:
        """
        Calls the Gemini API with structured retrieved context.
        Returns (generated_text, error_message, provider_name).
        """
        if not self.is_available:
            return None, "GEMINI_API_KEY is not configured or client initialization failed.", "ForgeSight Grounded Governance Engine"

        # Format prompt with retrieved evidence
        facts_block = "\n".join(retrieved_context.get("confirmed_facts", [])) or "None found."
        preds_block = "\n".join(retrieved_context.get("cnn_predictions", [])) or "None recorded."
        proc_block = "\n\n".join(retrieved_context.get("procedural_excerpts", [])) or "None relevant."
        missing_block = "\n".join(retrieved_context.get("missing_evidence", [])) or "None identified."

        prompt_content = f"""USER QUERY: {query}

=== RETRIEVED APPLICATION CONTEXT (GROUND TRUTH) ===
[CONFIRMED APPLICATION FACTS]:
{facts_block}

[CNN MODEL PREDICTIONS (AUTOMATED AI INFERENCE - NOT HUMAN CONFIRMED)]:
{preds_block}

[QUALITY STANDARD OPERATING PROCEDURES (SOPS)]:
{proc_block}

[NOTED MISSING EVIDENCE / DATA GAPS]:
{missing_block}
=== END CONTEXT ===

Instructions:
Synthesize a concise, well-structured, professional answer addressing the user's query directly based solely on the retrieved context above.
Include section headers, bullet points, source citations [RECORD_TYPE: ID], and a clear draft disclaimer if generating corrective action plans.
"""

        from google.genai import types

        # Try gemini-2.5-flash first, then fallback to gemini-1.5-flash
        models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash"]
        last_error = None

        for model_name in models_to_try:
            try:
                response = self._client.models.generate_content(
                    model=model_name,
                    contents=prompt_content,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.2,
                        max_output_tokens=1500,
                    )
                )
                if response and response.text:
                    return response.text, None, f"Google Gemini ({model_name}) + ForgeSight RAG"
            except Exception as e:
                last_error = str(e)
                logger.warning(f"[Gemini Client] Model {model_name} invocation error: {e}")

        return None, last_error or "Gemini API request failed", "ForgeSight Grounded Governance Engine"

gemini_client = GeminiCopilotClient()
