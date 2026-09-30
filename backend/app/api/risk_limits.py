from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database.session import get_db
from app.models.orm_models import RiskLimit, RiskAlert, RiskAppetite
from app.schemas.risk_limits import (
    RiskLimitCreate, RiskLimitResponse,
    RiskAlertCreate, RiskAlertResponse,
    RiskAppetiteCreate, RiskAppetiteResponse
)

router = APIRouter(prefix="/risk-limits", tags=["Risk Limits & Alerts"])

# Risk Limits
@router.get("/limits", response_model=List[RiskLimitResponse])
def get_risk_limits(db: Session = Depends(get_db)):
    limits = db.query(RiskLimit).all()
    return limits

@router.post("/limits", response_model=RiskLimitResponse)
def create_risk_limit(limit: RiskLimitCreate, db: Session = Depends(get_db)):
    db_limit = RiskLimit(**limit.dict())
    db.add(db_limit)
    db.commit()
    db.refresh(db_limit)
    return db_limit

@router.put("/limits/{limit_id}", response_model=RiskLimitResponse)
def update_risk_limit(limit_id: int, current_value: float, db: Session = Depends(get_db)):
    limit = db.query(RiskLimit).filter(RiskLimit.id == limit_id).first()
    if not limit:
        raise HTTPException(status_code=404, detail="Limit not found")
    
    limit.current_value = current_value
    limit.utilization_pct = (current_value / limit.hard_limit) * 100 if limit.hard_limit > 0 else 0
    
    if limit.current_value >= limit.hard_limit:
        limit.status = "RED"
        # Auto-create alert
        alert = RiskAlert(
            alert_level="CRITICAL",
            message=f"Hard limit breached for {limit.entity_id} on {limit.limit_type}",
            source="System Monitor"
        )
        db.add(alert)
    elif limit.current_value >= limit.warning_limit:
        limit.status = "YELLOW"
        alert = RiskAlert(
            alert_level="WARNING",
            message=f"Warning limit breached for {limit.entity_id} on {limit.limit_type}",
            source="System Monitor"
        )
        db.add(alert)
    else:
        limit.status = "GREEN"
        
    db.commit()
    db.refresh(limit)
    return limit

# Risk Alerts
@router.get("/alerts", response_model=List[RiskAlertResponse])
def get_risk_alerts(db: Session = Depends(get_db)):
    return db.query(RiskAlert).all()

@router.post("/alerts", response_model=RiskAlertResponse)
def create_risk_alert(alert: RiskAlertCreate, db: Session = Depends(get_db)):
    db_alert = RiskAlert(**alert.dict())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert

@router.put("/alerts/{alert_id}/resolve", response_model=RiskAlertResponse)
def resolve_risk_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(RiskAlert).filter(RiskAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = "RESOLVED"
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert

# Risk Appetite
@router.get("/appetite", response_model=List[RiskAppetiteResponse])
def get_risk_appetite(db: Session = Depends(get_db)):
    return db.query(RiskAppetite).all()

@router.post("/appetite", response_model=RiskAppetiteResponse)
def create_risk_appetite(appetite: RiskAppetiteCreate, db: Session = Depends(get_db)):
    db_appetite = RiskAppetite(**appetite.dict())
    db.add(db_appetite)
    db.commit()
    db.refresh(db_appetite)
    return db_appetite
