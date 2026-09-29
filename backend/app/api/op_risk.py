
from fastapi import APIRouter
from pydantic import BaseModel
from app.quant.op_risk import sma_basel_capital

router = APIRouter(prefix="/api/op-risk", tags=["Operational Risk"])

class SMARequest(BaseModel):
    bic: float
    loss_multiplier: float = 1.0

@router.post("/sma")
async def calculate_sma(req: SMARequest):
    return {"status": "success", "data": sma_basel_capital(req.bic, req.loss_multiplier)}
