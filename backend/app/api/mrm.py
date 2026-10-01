from fastapi import APIRouter, Depends
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

class ModelRegistryUpdate(BaseModel):
    model_name: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None

@router.put("/{id}")
def update_modelregistry(id: int, item: ModelRegistryUpdate, db: Session = Depends(get_db)):
    db_item = db.query(ModelRegistry).filter(ModelRegistry.id == id).first()
    if not db_item:
        return {"error": "not found"}
    update_data = item.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(db_item, k, v)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{id}")
def delete_modelregistry(id: int, db: Session = Depends(get_db)):
    db_item = db.query(ModelRegistry).filter(ModelRegistry.id == id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"status": "deleted"}
