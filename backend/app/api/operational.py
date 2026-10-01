from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.database.session import get_db
from app.models.orm_models import CyberIncident

router = APIRouter(prefix="/api/operational", tags=["Operational Risk"])

class CyberIncidentBase(BaseModel):
    incident_date: datetime
    incident_type: str
    severity: str
    description: Optional[str] = None
    operational_loss: Optional[float] = None
    status: str = "OPEN"

@router.post("/incidents")
def create_incident(incident: CyberIncidentBase, db: Session = Depends(get_db)):
    db_incident = CyberIncident(**incident.dict())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident

@router.get("/incidents")
def get_incidents(db: Session = Depends(get_db)):
    return db.query(CyberIncident).all()

class CyberIncidentUpdate(BaseModel):
    incident_date: Optional[datetime] = None
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    operational_loss: Optional[float] = None
    status: Optional[str] = None

@router.put("/{id}")
def update_cyberincident(id: int, item: CyberIncidentUpdate, db: Session = Depends(get_db)):
    db_item = db.query(CyberIncident).filter(CyberIncident.id == id).first()
    if not db_item:
        return {"error": "not found"}
    update_data = item.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(db_item, k, v)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{id}")
def delete_cyberincident(id: int, db: Session = Depends(get_db)):
    db_item = db.query(CyberIncident).filter(CyberIncident.id == id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"status": "deleted"}
