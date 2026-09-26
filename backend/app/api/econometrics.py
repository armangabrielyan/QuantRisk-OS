"""QuantRisk OS - Econometrics API Router"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

from app.quant.econometrics import (
    adf_test,
    acf_pacf,
    descriptive_stats,
    ols_regression,
    regression_diagnostics,
    vif_analysis,
)

router = APIRouter(prefix="/api/econometrics", tags=["Econometrics"])


class TimeSeriesRequest(BaseModel):
    series: List[float] = Field(..., min_length=20)
    maxlag: Optional[int] = None
    regression: Literal["c", "ct", "ctt", "n"] = "c"
    nlags: int = Field(40, ge=5, le=100)


class OLSRequest(BaseModel):
    y: List[float] = Field(..., min_length=10)
    X: List[List[float]] = Field(..., min_length=1)
    feature_names: List[str]
    add_constant: bool = True


class DiagnosticsRequest(BaseModel):
    y: List[float] = Field(..., min_length=10)
    X: List[List[float]] = Field(..., min_length=1)


class VIFRequest(BaseModel):
    X: List[List[float]] = Field(..., min_length=1)
    feature_names: List[str]


@router.post("/time-series-diagnostics")
async def time_series_diagnostics(req: TimeSeriesRequest):
    """ADF unit root test + descriptive statistics."""
    try:
        adf_result = adf_test(req.series, maxlag=req.maxlag, regression=req.regression)
        desc_result = descriptive_stats(req.series)
        return {
            "status": "success",
            "data": {
                "adf_test": adf_result,
                "descriptive_stats": desc_result,
                "n_observations": len(req.series),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/acf-pacf")
async def acf_pacf_endpoint(req: TimeSeriesRequest):
    """ACF and PACF for time series model identification."""
    try:
        result = acf_pacf(req.series, nlags=req.nlags)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/descriptive-stats")
async def descriptive_stats_endpoint(req: TimeSeriesRequest):
    """Descriptive statistics for a time series."""
    try:
        result = descriptive_stats(req.series)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/ols-regression")
async def ols_regression_endpoint(req: OLSRequest):
    """OLS multiple regression with full diagnostics."""
    try:
        result = ols_regression(
            y=req.y,
            X=req.X,
            feature_names=req.feature_names,
            add_constant=req.add_constant,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/diagnostics")
async def diagnostics_endpoint(req: DiagnosticsRequest):
    """Regression diagnostics: heteroskedasticity, serial correlation."""
    try:
        result = regression_diagnostics(y=req.y, X=req.X)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/vif")
async def vif_endpoint(req: VIFRequest):
    """Variance Inflation Factor (VIF) for multicollinearity analysis."""
    try:
        result = vif_analysis(X=req.X, feature_names=req.feature_names)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")
