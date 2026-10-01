from fastapi import APIRouter, Depends
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

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    criticality: Optional[str] = None
    dependency_risk_score: Optional[float] = None

@router.put("/{id}")
def update_vendor(id: int, item: VendorUpdate, db: Session = Depends(get_db)):
    db_item = db.query(Vendor).filter(Vendor.id == id).first()
    if not db_item:
        return {"error": "not found"}
    update_data = item.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(db_item, k, v)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{id}")
def delete_vendor(id: int, db: Session = Depends(get_db)):
    db_item = db.query(Vendor).filter(Vendor.id == id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"status": "deleted"}
