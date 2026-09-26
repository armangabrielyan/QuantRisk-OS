"""QuantRisk OS - Credit Risk API Router"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal

from app.quant.credit_risk import expected_loss, merton_model, credit_scoring_pipeline

router = APIRouter(prefix="/api/credit-risk", tags=["Credit Risk"])


class ExposureItem(BaseModel):
    name: str = "Exposure"
    pd: float = Field(..., ge=0, le=1)
    lgd: float = Field(..., ge=0, le=1)
    ead: float = Field(..., gt=0)


class ExpectedLossRequest(BaseModel):
    exposures: List[ExposureItem] = Field(..., min_length=1)


class MertonModelRequest(BaseModel):
    asset_value: float = Field(..., gt=0)
    asset_volatility: float = Field(..., gt=0, le=5.0)
    debt: float = Field(..., gt=0)
    maturity: float = Field(..., gt=0, le=30.0)
    risk_free_rate: float = Field(..., ge=0, le=1.0)


class CreditScoringRequest(BaseModel):
    data: List[dict]
    target_col: str
    feature_cols: List[str]
    test_size: float = Field(0.2, gt=0, lt=1)
    seed: int = 42


@router.post("/expected-loss")
async def expected_loss_endpoint(req: ExpectedLossRequest):
    """Compute portfolio Expected Loss = PD × LGD × EAD."""
    try:
        exposures = [e.model_dump() for e in req.exposures]
        result = expected_loss(exposures)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/merton-model")
async def merton_model_endpoint(req: MertonModelRequest):
    """Merton structural credit model: Distance to Default and PD."""
    try:
        result = merton_model(
            asset_value=req.asset_value,
            asset_volatility=req.asset_volatility,
            debt=req.debt,
            maturity=req.maturity,
            risk_free_rate=req.risk_free_rate,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/credit-scoring")
async def credit_scoring_endpoint(req: CreditScoringRequest):
    """Logistic regression credit scoring: AUC, Gini, coefficients, ROC curve."""
    try:
        if len(req.data) < 20:
            raise ValueError("Need at least 20 data rows for credit scoring")
        result = credit_scoring_pipeline(
            data=req.data,
            target_col=req.target_col,
            feature_cols=req.feature_cols,
            test_size=req.test_size,
            seed=req.seed,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")
