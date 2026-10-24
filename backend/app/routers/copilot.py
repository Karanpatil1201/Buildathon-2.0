import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import CopilotQuery, CopilotResponse
from app.auth import get_current_user
from app.copilot.engine import copilot_engine
from app.copilot.retriever import rag_retriever

router = APIRouter(prefix="/copilot", tags=["Quality Copilot"])

@router.post("/query", response_model=CopilotResponse)
def query_copilot(
    query_in: CopilotQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not query_in.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    return copilot_engine.process_query(
        query_str=query_in.query,
        current_user=current_user,
        db=db,
        batch_param=query_in.batch_number
    )

@router.post("/stream")
def stream_copilot(
    query_in: CopilotQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Streams real processing stages (Understanding, Retrieving, Checking SOPs, Generating)
    via Server-Sent Events (SSE) before delivering the final grounded response.
    """
    if not query_in.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    query_str = query_in.query.strip()
    batch_param = query_in.batch_number

    def event_stream():
        # Stage 1: Understanding question & checking safety guards
        yield f"event: stage\ndata: {json.dumps({'stage': 'Understanding your question', 'step': 1, 'total': 4})}\n\n"
        
        safety_resp = copilot_engine.check_safety_guard(query_str)
        if safety_resp:
            yield f"event: result\ndata: {json.dumps(safety_resp.dict())}\n\n"
            yield f"event: done\ndata: {{}}\n\n"
            return

        # Stage 2: Retrieving batch and inspection records
        yield f"event: stage\ndata: {json.dumps({'stage': 'Retrieving batch and inspection records', 'step': 2, 'total': 4})}\n\n"
        retrieved = rag_retriever.retrieve_context(
            query_str=query_str,
            current_user=current_user,
            db=db,
            batch_param=batch_param
        )

        # Stage 3: Checking quality procedures
        yield f"event: stage\ndata: {json.dumps({'stage': 'Checking quality procedures', 'step': 3, 'total': 4})}\n\n"
        # Procedure keyword lookup has been executed in retriever

        # Stage 4: Generating grounded response
        yield f"event: stage\ndata: {json.dumps({'stage': 'Generating grounded response', 'step': 4, 'total': 4})}\n\n"
        res = copilot_engine.synthesize_from_retrieved(
            query_str=query_str,
            retrieved=retrieved,
            db=db,
            batch_param=batch_param
        )

        # Send final completed response
        yield f"event: result\ndata: {json.dumps(res.dict())}\n\n"
        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
