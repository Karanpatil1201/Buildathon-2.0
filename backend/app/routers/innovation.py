from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import PrioritizedInspectionOut, PrioritizationEvaluationOut
from app.auth import get_current_user
from app.services.prioritization import get_prioritized_inspections, evaluate_prioritization_benchmark

router = APIRouter(prefix="/prioritization", tags=["Evidence-Driven Prioritization"])

@router.get("/queue", response_model=List[PrioritizedInspectionOut])
def get_prioritization_queue(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_prioritized_inspections(db, limit=limit)

@router.get("/benchmark", response_model=Dict[str, Any])
def get_benchmark_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return evaluate_prioritization_benchmark(db)
