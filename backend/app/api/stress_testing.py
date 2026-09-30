"""QuantRisk OS - Stress Testing API Router"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from app.quant.stress_testing import apply_stress_scenario, get_scenario_presets, CRISIS_SCENARIOS

router = APIRouter(prefix="/api/stress-testing", tags=["Stress Testing"])


class StressScenarioRequest(BaseModel):
    portfolio_value: float = Field(..., gt=0)
    var_base: float = Field(..., gt=0)
    es_base: float = Field(..., gt=0)
    vol_base: float = Field(..., gt=0)
    duration_gap_base: float = Field(0.0)
    lcr_base: float = Field(1.5, gt=0)
    equity_shock: float = Field(..., ge=-1.0, le=1.0)
    vol_shock: float = Field(..., ge=0.0, le=20.0)
    rate_shock: float = Field(0.0)
    credit_spread_shock: float = Field(0.0, ge=0)
    liquidity_shock: float = Field(0.0, ge=0.0, le=1.0)
    deposit_outflow: float = Field(0.0, ge=0.0, le=1.0)
    scenario_name: str = "Custom Scenario"


class PresetScenarioRequest(BaseModel):
    scenario_key: str
    portfolio_value: float = Field(10_000_000, gt=0)
    var_base: float = Field(150_000, gt=0)
    es_base: float = Field(210_000, gt=0)
    vol_base: float = Field(0.15, gt=0)
    duration_gap_base: float = Field(2.5)
    lcr_base: float = Field(1.35, gt=0)


@router.get("/scenarios")
async def get_scenarios():
    """Return all predefined crisis scenario presets."""
    return {
        "status": "success",
        "data": {
            key: {
                "key": key,
                "name": val["name"],
                "description": val["description"],
                "shocks": {k: v for k, v in val.items() if k not in ("name", "description")},
            }
            for key, val in CRISIS_SCENARIOS.items()
        },
    }


@router.post("/apply")
async def apply_stress_endpoint(req: StressScenarioRequest):
    """Apply a stress scenario to a portfolio."""
    try:
        result = apply_stress_scenario(
            portfolio_value=req.portfolio_value,
            var_base=req.var_base,
            es_base=req.es_base,
            vol_base=req.vol_base,
            duration_gap_base=req.duration_gap_base,
            lcr_base=req.lcr_base,
            equity_shock=req.equity_shock,
            vol_shock=req.vol_shock,
            rate_shock=req.rate_shock,
            credit_spread_shock=req.credit_spread_shock,
            liquidity_shock=req.liquidity_shock,
            deposit_outflow=req.deposit_outflow,
            scenario_name=req.scenario_name,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/apply-preset")
async def apply_preset_scenario(req: PresetScenarioRequest):
    """Apply a predefined crisis scenario preset."""
    try:
        scenario = CRISIS_SCENARIOS.get(req.scenario_key)
        if not scenario:
            raise HTTPException(status_code=404, detail=f"Scenario {req.scenario_key} not found")

        result = apply_stress_scenario(
            portfolio_value=req.portfolio_value,
            var_base=req.var_base,
            es_base=req.es_base,
            vol_base=req.vol_base,
            duration_gap_base=req.duration_gap_base,
            lcr_base=req.lcr_base,
            equity_shock=scenario["equity_shock"],
            vol_shock=scenario["vol_shock"],
            rate_shock=scenario["rate_shock"],
            credit_spread_shock=scenario["credit_spread_shock"],
            liquidity_shock=scenario["liquidity_shock"],
            deposit_outflow=scenario["deposit_outflow"],
            scenario_name=scenario["name"],
        )
        result["scenario_description"] = scenario["description"]
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

class ScenarioComparisonRequest(BaseModel):
    results: list[dict]

from app.quant.stress_testing import scenario_comparison

@router.post("/compare")
async def scenario_comparison_endpoint(req: ScenarioComparisonRequest):
    return {"status": "success", "data": scenario_comparison(req.results)}
