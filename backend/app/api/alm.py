"""QuantRisk OS - ALM / Liquidity API Router"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

from app.quant.alm import duration_gap, lcr_calculator, nsfr_calculator

router = APIRouter(prefix="/api/alm", tags=["ALM / Liquidity"])


class DurationGapRequest(BaseModel):
    asset_duration: float = Field(..., ge=0, description="Asset portfolio duration (years)")
    liability_duration: float = Field(..., ge=0, description="Liability portfolio duration (years)")
    asset_value: float = Field(..., gt=0, description="Total asset value")
    liability_value: float = Field(..., gt=0, description="Total liability value")
    rate_shock: float = Field(0.01, description="Parallel rate shock (e.g. 0.01 = 100bps)")


class LCRRequest(BaseModel):
    hqla: float = Field(..., ge=0, description="High Quality Liquid Assets")
    cash_outflows: float = Field(..., ge=0, description="30-day stress gross outflows")
    cash_inflows: float = Field(..., ge=0, description="30-day stress gross inflows")
    stress_horizon: int = Field(30, ge=1, le=90, description="Stress horizon in days")


class NSFRComponent(BaseModel):
    name: str
    amount: float = Field(..., ge=0)
    factor: float = Field(..., ge=0, le=1)


class NSFRRequest(BaseModel):
    asf_components: List[NSFRComponent] = Field(..., min_length=1)
    rsf_components: List[NSFRComponent] = Field(..., min_length=1)


@router.post("/duration-gap")
async def duration_gap_endpoint(req: DurationGapRequest):
    """Duration Gap analysis and equity sensitivity to interest rate changes."""
    try:
        result = duration_gap(
            asset_duration=req.asset_duration,
            liability_duration=req.liability_duration,
            asset_value=req.asset_value,
            liability_value=req.liability_value,
            rate_shock=req.rate_shock,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/lcr")
async def lcr_endpoint(req: LCRRequest):
    """LCR = HQLA / Net Cash Outflows (Basel III)."""
    try:
        result = lcr_calculator(
            hqla=req.hqla,
            cash_outflows=req.cash_outflows,
            cash_inflows=req.cash_inflows,
            stress_horizon=req.stress_horizon,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/nsfr")
async def nsfr_endpoint(req: NSFRRequest):
    """NSFR = Available Stable Funding / Required Stable Funding (Basel III)."""
    try:
        asf = [c.model_dump() for c in req.asf_components]
        rsf = [c.model_dump() for c in req.rsf_components]
        result = nsfr_calculator(
            asf_components=asf,
            rsf_components=rsf,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")
