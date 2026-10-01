from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.orm_models import AuditTrail, RiskHistory
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/api/audit", tags=["Audit"])

class AuditTrailCreate(BaseModel):
    user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class AuditTrailResponse(AuditTrailCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class RiskHistoryCreate(BaseModel):
    portfolio_id: Optional[int] = None
    metrics: Dict[str, Any]

class RiskHistoryResponse(RiskHistoryCreate):
    id: int
    date: datetime
    created_at: datetime

    class Config:
        from_attributes = True

@router.post("/trail", response_model=AuditTrailResponse)
async def create_audit_trail(item: AuditTrailCreate, db: Session = Depends(get_db)):
    db_item = AuditTrail(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/trail", response_model=List[AuditTrailResponse])
async def get_audit_trail(db: Session = Depends(get_db)):
    return db.query(AuditTrail).order_by(AuditTrail.timestamp.desc()).limit(100).all()

@router.post("/history", response_model=RiskHistoryResponse)
async def create_risk_history(item: RiskHistoryCreate, db: Session = Depends(get_db)):
    db_item = RiskHistory(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/history", response_model=List[RiskHistoryResponse])
async def get_risk_history(portfolio_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(RiskHistory)
    if portfolio_id:
        query = query.filter(RiskHistory.portfolio_id == portfolio_id)
    return query.order_by(RiskHistory.date.desc()).limit(100).all()
