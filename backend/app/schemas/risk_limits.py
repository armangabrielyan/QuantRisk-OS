from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class RiskLimitBase(BaseModel):
    entity_id: str
    limit_type: str
    warning_limit: float
    hard_limit: float
    current_value: Optional[float] = 0.0
    utilization_pct: Optional[float] = 0.0
    status: Optional[str] = "GREEN"

class RiskLimitCreate(RiskLimitBase):
    pass

class RiskLimitResponse(RiskLimitBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class RiskAlertBase(BaseModel):
    alert_level: str
    message: str
    source: Optional[str] = None
    status: Optional[str] = "ACTIVE"

class RiskAlertCreate(RiskAlertBase):
    pass

class RiskAlertResponse(RiskAlertBase):
    id: int
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RiskAppetiteBase(BaseModel):
    statement: str
    metrics: Optional[Dict[str, Any]] = None

class RiskAppetiteCreate(RiskAppetiteBase):
    pass

class RiskAppetiteResponse(RiskAppetiteBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
