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


class NSSRequest(BaseModel):
    maturities: list[float]
    b0: float
    b1: float
    b2: float
    b3: float
    tau1: float
    tau2: float

class BondMetricsRequest(BaseModel):
    cashflows: list[float]
    times: list[float]
    yield_rate: float
    current_price: float = None

from app.quant.alm import nelson_siegel_svensson, bond_dv01_convexity

@router.post("/nelson-siegel")
async def nss_endpoint(req: NSSRequest):
    return {"status": "success", "data": nelson_siegel_svensson(req.maturities, req.b0, req.b1, req.b2, req.b3, req.tau1, req.tau2)}

@router.post("/bond-metrics")
async def bond_metrics_endpoint(req: BondMetricsRequest):
    return {"status": "success", "data": bond_dv01_convexity(req.cashflows, req.times, req.yield_rate, req.current_price)}

class GapRequest(BaseModel):
    assets: list[dict]
    liabilities: list[dict]
    buckets: list[str]

class LiquidityGapRequest(BaseModel):
    cash_inflows: list[dict]
    cash_outflows: list[dict]
    buckets: list[str]

class CumulativeGapRequest(BaseModel):
    gap_dict: dict
    buckets: list[str]

class InterestRateGapRequest(BaseModel):
    rsa: float
    rsl: float

from app.quant.alm import repricing_gap, liquidity_gap, cumulative_gap, interest_rate_gap

@router.post("/repricing-gap")
async def repricing_gap_endpoint(req: GapRequest):
    return {"status": "success", "data": repricing_gap(req.assets, req.liabilities, req.buckets)}

@router.post("/liquidity-gap")
async def liquidity_gap_endpoint(req: LiquidityGapRequest):
    return {"status": "success", "data": liquidity_gap(req.cash_inflows, req.cash_outflows, req.buckets)}

@router.post("/cumulative-gap")
async def cumulative_gap_endpoint(req: CumulativeGapRequest):
    return {"status": "success", "data": cumulative_gap(req.gap_dict, req.buckets)}

@router.post("/interest-rate-gap")
async def interest_rate_gap_endpoint(req: InterestRateGapRequest):
    return {"status": "success", "data": interest_rate_gap(req.rsa, req.rsl)}
