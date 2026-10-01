from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.quant.esg import calculate_waci, calculate_carbon_exposure
from app.database.session import get_db
from app.models.orm_models import ESGMetric

router = APIRouter(prefix="/api/esg", tags=["ESG & Climate Risk"])

class PositionESG(BaseModel):
    weight: float
    carbon_emissions: float
    revenue: float

class WACIRequest(BaseModel):
    positions: List[PositionESG]

@router.post("/waci")
async def get_waci(req: WACIRequest):
    waci = calculate_waci([p.dict() for p in req.positions])
    exposure = calculate_carbon_exposure([p.dict() for p in req.positions])
    return {"status": "success", "data": {"waci": waci, "carbon_exposure": exposure}}

class ESGMetricBase(BaseModel):
    entity_id: str
    carbon_exposure: Optional[float] = None
    waci: Optional[float] = None
    climate_stress_result: Optional[dict] = None
    transition_risk_score: Optional[float] = None
    physical_risk_score: Optional[float] = None

@router.post("/metrics")
def create_esg_metric(metric: ESGMetricBase, db: Session = Depends(get_db)):
    db_metric = ESGMetric(**metric.dict())
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric

@router.get("/metrics")
def get_esg_metrics(db: Session = Depends(get_db)):
    return db.query(ESGMetric).all()

class ESGMetricUpdate(BaseModel):
    carbon_exposure: Optional[float] = None
    waci: Optional[float] = None
    climate_stress_result: Optional[dict] = None
    transition_risk_score: Optional[float] = None
    physical_risk_score: Optional[float] = None

@router.put("/{id}")
def update_esgmetric(id: int, item: ESGMetricUpdate, db: Session = Depends(get_db)):
    db_item = db.query(ESGMetric).filter(ESGMetric.id == id).first()
    if not db_item:
        return {"error": "not found"}
    update_data = item.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(db_item, k, v)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{id}")
def delete_esgmetric(id: int, db: Session = Depends(get_db)):
    db_item = db.query(ESGMetric).filter(ESGMetric.id == id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"status": "deleted"}
