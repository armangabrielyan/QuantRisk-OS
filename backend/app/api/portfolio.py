"""QuantRisk OS - Portfolio Analytics API Router"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import List

from app.quant.portfolio import portfolio_analytics, efficient_frontier, maximum_drawdown

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio Analytics"])


class PortfolioAnalyticsRequest(BaseModel):
    returns_matrix: List[List[float]] = Field(
        ..., description="List of return series per asset: shape (n_assets, n_periods)"
    )
    weights: List[float]
    asset_names: List[str]
    risk_free_rate: float = Field(0.02, ge=0, le=1.0)

    @field_validator("weights")
    @classmethod
    def weights_sum_to_one(cls, v):
        total = sum(v)
        if abs(total - 1.0) > 0.02:
            raise ValueError(f"Weights must sum to 1.0, got {total:.4f}")
        return v


class EfficientFrontierRequest(BaseModel):
    returns_matrix: List[List[float]]
    asset_names: List[str]
    n_portfolios: int = Field(500, ge=100, le=5000)
    risk_free_rate: float = Field(0.02, ge=0, le=1.0)


class DrawdownRequest(BaseModel):
    returns: List[float] = Field(..., min_length=2)


@router.post("/analytics")
async def portfolio_analytics_endpoint(req: PortfolioAnalyticsRequest):
    """Full portfolio analytics: return, vol, Sharpe, Sortino, drawdown, covariance."""
    try:
        result = portfolio_analytics(
            returns_matrix=req.returns_matrix,
            weights=req.weights,
            asset_names=req.asset_names,
            risk_free_rate=req.risk_free_rate,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/efficient-frontier")
async def efficient_frontier_endpoint(req: EfficientFrontierRequest):
    """Markowitz efficient frontier with min-vol and max-Sharpe portfolios."""
    try:
        result = efficient_frontier(
            returns_matrix=req.returns_matrix,
            asset_names=req.asset_names,
            n_portfolios=req.n_portfolios,
            risk_free_rate=req.risk_free_rate,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/drawdown")
async def drawdown_endpoint(req: DrawdownRequest):
    """Compute maximum drawdown from a return series."""
    try:
        result = maximum_drawdown(req.returns)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


class BlackLittermanRequest(BaseModel):
    returns: list[float]
    cov_matrix: list[list[float]]
    market_weights: list[float]
    views: list[float]
    p_matrix: list[list[float]]
    tau: float = 0.05

class RiskParityRequest(BaseModel):
    cov_matrix: list[list[float]]

class HHIRequest(BaseModel):
    weights: list[float]

from app.quant.portfolio import black_litterman, risk_parity_weights, hhi_concentration

@router.post("/black-litterman")
async def bl_endpoint(req: BlackLittermanRequest):
    return {"status": "success", "data": black_litterman(req.returns, req.cov_matrix, req.market_weights, req.views, req.p_matrix, req.tau)}

@router.post("/risk-parity")
async def rp_endpoint(req: RiskParityRequest):
    return {"status": "success", "data": risk_parity_weights(req.cov_matrix)}

@router.post("/concentration")
async def hhi_endpoint(req: HHIRequest):
    return {"status": "success", "data": hhi_concentration(req.weights)}

@router.get("/summary")
async def portfolio_summary():
    """Placeholder for portfolio summary metrics."""
    return {
        "status": "success",
        "data": {
            "value": 10000000,
            "currency": "USD"
        }
    }
