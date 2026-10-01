import numpy as np
from typing import Optional
"""QuantRisk OS - Portfolio Analytics API Router"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import List

from app.quant.portfolio import portfolio_analytics, efficient_frontier, maximum_drawdown

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio Analytics"])

def get_cov(req):
    if hasattr(req, 'cov_matrix') and req.cov_matrix:
        return req.cov_matrix
    if hasattr(req, 'returns_matrix') and req.returns_matrix:
        import numpy as np
        # Input is typically (n_assets, n_periods). np.cov expects (n_features, n_samples)
        # We need to make sure we treat rows as assets.
        arr = np.array(req.returns_matrix)
        if arr.shape[0] != len(req.weights):
            arr = arr.T
        return np.cov(arr).tolist()
    return []




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

from fastapi import UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.data_architecture import PortfolioDataHubService

@router.post('/import-csv')
async def import_portfolio_csv(name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        text = content.decode('utf-8')
        portfolio = PortfolioDataHubService.import_from_csv(db, text, name)
        return {'status': 'success', 'portfolio_id': portfolio.id, 'total_value': portfolio.total_value}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class MarginalVaRRequest(BaseModel):
    weights: list[float]
    cov_matrix: Optional[list[list[float]]] = None
    returns_matrix: Optional[list[list[float]]] = None
    confidence: float = 0.99

class ComponentVaRRequest(BaseModel):
    weights: list[float]
    cov_matrix: Optional[list[list[float]]] = None
    returns_matrix: Optional[list[list[float]]] = None
    portfolio_value: float = 1_000_000.0
    confidence: float = 0.99

class IncrementalVaRRequest(BaseModel):
    weights: list[float]
    cov_matrix: Optional[list[list[float]]] = None
    returns_matrix: Optional[list[list[float]]] = None
    new_asset_weight: float = 0.1
    new_asset_cov: Optional[list[float]] = None
    confidence: float = 0.99

class VaRAttributionRequest(BaseModel):
    weights: list[float]
    component_vars: Optional[list[float]] = None
    returns_matrix: Optional[list[list[float]]] = None

class CorrelationStressRequest(BaseModel):
    weights: list[float]
    cov_matrix: Optional[list[list[float]]] = None
    returns_matrix: Optional[list[list[float]]] = None
    stress_factors: Optional[list[float]] = [1.5]
    stress_factor: float = 1.5

class DiversificationBenefitRequest(BaseModel):
    weights: list[float]
    cov_matrix: list[list[float]]
    individual_vars: list[float]

class PnLAttributionRequest(BaseModel):
    pnl: float = 10000.0
    factors: Optional[dict] = None
    returns_matrix: Optional[list[list[float]]] = None
    weights: Optional[list[float]] = None

from app.quant.portfolio import (
    marginal_var, component_var, incremental_var, var_attribution,
    correlation_stress, diversification_benefit, pnl_attribution
)

@router.post("/marginal-var")
async def marginal_var_endpoint(req: MarginalVaRRequest):
    cov = get_cov(req)
    return {"status": "success", "data": marginal_var(req.weights, cov, req.confidence)}

@router.post("/component-var")
async def component_var_endpoint(req: ComponentVaRRequest):
    cov = get_cov(req)
    return {"status": "success", "data": component_var(req.weights, cov, req.portfolio_value, req.confidence)}

@router.post("/incremental-var")
async def incremental_var_endpoint(req: IncrementalVaRRequest):
    cov = get_cov(req)
    n_cov = req.new_asset_cov or [0.0]*len(req.weights)
    return {"status": "success", "data": incremental_var(req.weights, cov, req.new_asset_weight, n_cov, req.confidence)}

@router.post("/var-attribution")
async def var_attribution_endpoint(req: VaRAttributionRequest):
    c_vars = req.component_vars
    if not c_vars and req.returns_matrix:
        cov = get_cov(req)
        res = component_var(req.weights, cov, 1000000.0, 0.99)
        c_vars = res.get("component_vars", [0.0]*len(req.weights))
    return {"status": "success", "data": var_attribution(req.weights, c_vars)}

@router.post("/correlation-stress")
async def correlation_stress_endpoint(req: CorrelationStressRequest):
    cov = get_cov(req)
    sf = req.stress_factors[0] if req.stress_factors else req.stress_factor
    return {"status": "success", "data": correlation_stress(req.weights, cov, sf)}

@router.post("/diversification-benefit")
async def diversification_benefit_endpoint(req: DiversificationBenefitRequest):
    return {"status": "success", "data": diversification_benefit(req.weights, req.cov_matrix, req.individual_vars)}

@router.post("/pnl-attribution")
async def pnl_attribution_endpoint(req: PnLAttributionRequest):
    factors = req.factors or {"Market": 0.5, "Sector": 0.3, "Idiosyncratic": 0.2}
    return {"status": "success", "data": pnl_attribution(req.pnl, factors)}
