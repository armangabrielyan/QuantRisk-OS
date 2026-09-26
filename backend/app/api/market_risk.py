"""QuantRisk OS - Market Risk API Router"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from app.quant.market_risk import (
    parametric_var,
    historical_var,
    monte_carlo_var,
    ewma_volatility,
    garch_volatility,
    historical_volatility,
    black_scholes,
    implied_volatility,
    volatility_surface_data,
)

router = APIRouter(prefix="/api/market-risk", tags=["Market Risk"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ParametricVaRRequest(BaseModel):
    returns: List[float] = Field(..., min_length=10, description="Historical returns as decimals")
    confidence: float = Field(0.99, ge=0.5, le=0.9999)
    holding_period: int = Field(1, ge=1, le=252)
    portfolio_value: float = Field(1_000_000, gt=0)
    distribution: Literal["normal", "student_t"] = "normal"


class HistoricalVaRRequest(BaseModel):
    returns: List[float] = Field(..., min_length=10)
    confidence: float = Field(0.99, ge=0.5, le=0.9999)
    holding_period: int = Field(1, ge=1, le=252)
    portfolio_value: float = Field(1_000_000, gt=0)
    bootstrap: bool = False
    n_bootstrap: int = Field(10000, ge=1000, le=100000)
    seed: int = 42


class MonteCarloVaRRequest(BaseModel):
    portfolio_value: float = Field(1_000_000, gt=0)
    mu: float = Field(0.0, description="Daily drift")
    sigma: float = Field(0.01, gt=0, description="Daily volatility")
    horizon: int = Field(10, ge=1, le=252)
    n_simulations: int = Field(10000, ge=100, le=100000)
    confidence: float = Field(0.99, ge=0.5, le=0.9999)
    seed: int = 42


class VolatilityRequest(BaseModel):
    returns: List[float] = Field(..., min_length=30)
    method: Literal["historical", "ewma", "garch"] = "ewma"
    lambda_: float = Field(0.94, ge=0.01, le=0.9999)


class BlackScholesRequest(BaseModel):
    S: float = Field(..., gt=0, description="Spot price")
    K: float = Field(..., gt=0, description="Strike price")
    T: float = Field(..., gt=0, description="Time to maturity in years")
    r: float = Field(..., description="Risk-free rate (continuous)")
    sigma: float = Field(..., gt=0, description="Annual volatility")
    q: float = Field(0.0, description="Continuous dividend yield")
    option_type: Literal["call", "put"] = "call"


class ImpliedVolRequest(BaseModel):
    market_price: float = Field(..., gt=0)
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float
    q: float = 0.0
    option_type: Literal["call", "put"] = "call"


class VolSurfaceRequest(BaseModel):
    S: float = Field(..., gt=0)
    strikes: List[float] = Field(..., min_length=2)
    maturities: List[float] = Field(..., min_length=2)
    r: float = 0.05
    q: float = 0.0


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/var/parametric")
async def parametric_var_endpoint(req: ParametricVaRRequest):
    """Parametric VaR using Normal or Student-t distribution."""
    try:
        result = parametric_var(
            returns=req.returns,
            confidence=req.confidence,
            holding_period=req.holding_period,
            portfolio_value=req.portfolio_value,
            distribution=req.distribution,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/var/historical")
async def historical_var_endpoint(req: HistoricalVaRRequest):
    """Historical simulation VaR."""
    try:
        result = historical_var(
            returns=req.returns,
            confidence=req.confidence,
            holding_period=req.holding_period,
            portfolio_value=req.portfolio_value,
            bootstrap=req.bootstrap,
            n_bootstrap=req.n_bootstrap,
            seed=req.seed,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/var/monte-carlo")
async def monte_carlo_var_endpoint(req: MonteCarloVaRRequest):
    """Monte Carlo VaR using Geometric Brownian Motion."""
    try:
        result = monte_carlo_var(
            portfolio_value=req.portfolio_value,
            mu=req.mu,
            sigma=req.sigma,
            horizon=req.horizon,
            n_simulations=req.n_simulations,
            confidence=req.confidence,
            seed=req.seed,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/volatility")
async def volatility_endpoint(req: VolatilityRequest):
    """Compute volatility: historical, EWMA, or GARCH(1,1)."""
    try:
        if req.method == "ewma":
            result = ewma_volatility(req.returns, lambda_=req.lambda_)
        elif req.method == "garch":
            result = garch_volatility(req.returns)
        else:
            result = historical_volatility(req.returns)
        result["method"] = req.method
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/black-scholes")
async def black_scholes_endpoint(req: BlackScholesRequest):
    """Black-Scholes-Merton option pricing and Greeks."""
    try:
        result = black_scholes(
            S=req.S,
            K=req.K,
            T=req.T,
            r=req.r,
            sigma=req.sigma,
            q=req.q,
            option_type=req.option_type,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/implied-volatility")
async def implied_vol_endpoint(req: ImpliedVolRequest):
    """Compute implied volatility using Brent's method."""
    try:
        result = implied_volatility(
            market_price=req.market_price,
            S=req.S,
            K=req.K,
            T=req.T,
            r=req.r,
            q=req.q,
            option_type=req.option_type,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/volatility-surface")
async def vol_surface_endpoint(req: VolSurfaceRequest):
    """Compute or generate an implied volatility surface."""
    try:
        result = volatility_surface_data(
            S=req.S,
            strikes=req.strikes,
            maturities=req.maturities,
            r=req.r,
            q=req.q,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")
