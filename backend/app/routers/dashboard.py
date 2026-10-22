from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.database import get_db
from app.models import Inspection, ConfirmedDefect, CorrectiveAction, Batch, Product
from app.schemas import DashboardMetricsOut, TrendPoint
from app.routers.inspections import _format_inspection_out

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/metrics", response_model=DashboardMetricsOut)
def get_dashboard_metrics(
    batch_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    insp_query = db.query(Inspection)
    defect_query = db.query(ConfirmedDefect)
    action_query = db.query(CorrectiveAction)
    batch_query = db.query(Batch)

    if batch_id:
        insp_query = insp_query.filter(Inspection.batch_id == batch_id)
        defect_query = defect_query.filter(ConfirmedDefect.batch_id == batch_id)
        action_query = action_query.join(ConfirmedDefect).filter(ConfirmedDefect.batch_id == batch_id)
        batch_query = batch_query.filter(Batch.id == batch_id)
    elif product_id:
        insp_query = insp_query.filter(Inspection.product_id == product_id)
        defect_query = defect_query.join(Batch).filter(Batch.product_id == product_id)
        action_query = action_query.join(ConfirmedDefect).join(Batch).filter(Batch.product_id == product_id)
        batch_query = batch_query.filter(Batch.product_id == product_id)

    # Count distinct item identifiers (not photographs)
    total_distinct_items = insp_query.with_entities(func.count(distinct(Inspection.item_identifier))).scalar() or 0
    
    pending_reviews = insp_query.filter(Inspection.status.in_(["INFERENCE_COMPLETED", "UNDER_REVIEW"])).count()
    confirmed_defects = defect_query.count()

    now = datetime.utcnow()
    open_actions = action_query.filter(CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"])).count()
    overdue_actions = action_query.filter(
        CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"]),
        CorrectiveAction.target_date < now
    ).count()

    batches_on_hold = batch_query.filter(Batch.status == "ON_HOLD").count()

    # Overall Defect Rate: Confirmed Defects / Distinct Inspected Items
    overall_defect_rate = round(
        (confirmed_defects / total_distinct_items * 100.0) if total_distinct_items > 0 else 0.0,
        2
    )

    # Recent inspections
    recent_inspections = insp_query.order_by(Inspection.created_at.desc()).limit(8).all()
    recent_out = [_format_inspection_out(i) for i in recent_inspections]

    # 7-day trend history
    trend_history: List[TrendPoint] = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        day_items = (
            db.query(func.count(distinct(Inspection.item_identifier)))
            .filter(Inspection.created_at >= day_start, Inspection.created_at < day_end)
            .scalar()
        ) or 0

        day_defects = (
            db.query(func.count(ConfirmedDefect.id))
            .filter(ConfirmedDefect.created_at >= day_start, ConfirmedDefect.created_at < day_end)
            .scalar()
        ) or 0

        day_rate = round((day_defects / day_items * 100.0) if day_items > 0 else 0.0, 1)

        trend_history.append(TrendPoint(
            date=day_start.strftime("%b %d"),
            inspected_count=day_items,
            defect_count=day_defects,
            defect_rate=day_rate
        ))

    return DashboardMetricsOut(
        total_inspected_items=total_distinct_items,
        pending_reviews=pending_reviews,
        confirmed_defects=confirmed_defects,
        open_corrective_actions=open_actions,
        overdue_actions=overdue_actions,
        overall_defect_rate=overall_defect_rate,
        batches_on_hold=batches_on_hold,
        recent_inspections=recent_out,
        trend_history=trend_history
    )
