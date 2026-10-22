from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import CopilotQuery, CopilotResponse
from app.auth import get_current_user
from app.copilot.engine import copilot_engine

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
