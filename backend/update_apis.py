import os

esg_code = """from fastapi import APIRouter, Depends
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
"""

op_code = """from fastapi import APIRouter, Depends
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
"""

vendor_code = """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database.session import get_db
from app.models.orm_models import Vendor

router = APIRouter(prefix="/api/vendor", tags=["Third-Party Risk"])

class VendorBase(BaseModel):
    name: str
    criticality: str
    dependency_risk_score: Optional[float] = None

@router.post("/")
def create_vendor(vendor: VendorBase, db: Session = Depends(get_db)):
    db_vendor = Vendor(**vendor.dict())
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor

@router.get("/")
def get_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).all()
"""

mrm_code = """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database.session import get_db
from app.models.orm_models import ModelRegistry

router = APIRouter(prefix="/api/mrm", tags=["Model Risk Management"])

class ModelRegistryBase(BaseModel):
    model_name: str
    version: str
    status: str = "DEVELOPMENT"

@router.post("/registry")
def register_model(model: ModelRegistryBase, db: Session = Depends(get_db)):
    db_model = ModelRegistry(**model.dict())
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@router.get("/registry")
def get_models(db: Session = Depends(get_db)):
    return db.query(ModelRegistry).all()
"""

with open("backend/app/api/esg.py", "w") as f:
    f.write(esg_code)
with open("backend/app/api/operational.py", "w") as f:
    f.write(op_code)
with open("backend/app/api/vendor.py", "w") as f:
    f.write(vendor_code)
with open("backend/app/api/mrm.py", "w") as f:
    f.write(mrm_code)

print("Backend APIs updated.")
