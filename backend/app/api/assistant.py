from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])

class Action(BaseModel):
    label: str
    route: str
    action_type: str
    payload: Optional[Dict[str, Any]] = None

class AssistantResponse(BaseModel):
    message: str
    actions: List[Action] = []

class AssistantRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None
    route: Optional[str] = None

@router.post("/ask", response_model=AssistantResponse)
async def ask_assistant(req: AssistantRequest):
    query = req.query.lower()
    
    if "monte carlo" in query or ("var" in query and "calculate" in query):
        return AssistantResponse(
            message="Market Risk → VaR → Monte Carlo",
            actions=[
                Action(label="Open Monte Carlo VaR", route="/market-risk", action_type="navigate")
            ]
        )
    
    if "200 bp" in query or "200bp" in query or "interest-rate shock" in query or "stress" in query:
        return AssistantResponse(
            message="Recommended tools:\n\nALM & Liquidity → DV01\nStress Testing → Custom Scenario",
            actions=[
                Action(label="Open DV01", route="/alm-liquidity", action_type="navigate"),
                Action(label="Open Stress Testing", route="/stress-testing", action_type="navigate")
            ]
        )
        
    if "full risk check" in query:
        return AssistantResponse(
            message="Executive Risk Summary:\n\n- Data Quality: OK\n- Portfolio Valuation: $1.2M\n- VaR: $45k\n- Expected Shortfall: $55k\n- Concentration: Low\n- Credit Risk: Stable\n- Liquidity: LCR 110%\n- DV01: -$1.5k\n- Risk Limits: No breaches\n- Alerts: None",
            actions=[]
        )
        
    if "biggest risk" in query or "largest risk" in query:
        return AssistantResponse(
            message="Your largest risks currently stem from high VaR utilization in the technology sector.",
            actions=[
                Action(label="Check Portfolio Risk", route="/portfolio", action_type="navigate")
            ]
        )
        
    if "limit" in query and ("show" in query or "close to" in query or "breach" in query):
        return AssistantResponse(
            message="Showing counterparties close to their limits.",
            actions=[
                Action(label="Open Risk Limits", route="/limits", action_type="navigate")
            ]
        )
        
    if "report" in query and "committee" in query:
        return AssistantResponse(
            message="Preparing a Risk Committee Report.",
            actions=[
                Action(label="Open Reports", route="/reports", action_type="navigate")
            ]
        )

    if "liquidity" in query:
        return AssistantResponse(
            message="Navigating to ALM & Liquidity analysis.",
            actions=[
                Action(label="Open ALM & Liquidity", route="/alm-liquidity", action_type="navigate")
            ]
        )

    if "contribute" in query and "var" in query:
        return AssistantResponse(
            message="To see which positions contribute most to VaR, open Portfolio Analytics and check VaR Attribution.",
            actions=[
                Action(label="Open Portfolio Analytics", route="/portfolio", action_type="navigate")
            ]
        )

    if "compare" in query and "var" in query:
        return AssistantResponse(
            message="You can compare historical VaR metrics in the Market Risk module.",
            actions=[
                Action(label="Open Market Risk", route="/market-risk", action_type="navigate")
            ]
        )
        
    if "mean" in query and req.route:
        # Context aware
        module_name = req.route.strip("/")
        return AssistantResponse(
            message=f"Based on your current context in {module_name}, this result indicates the outcome of the model currently displayed. It reflects the simulated risk factors.",
            actions=[]
        )

    # Fallback
    return AssistantResponse(
        message="I can help you navigate the platform, run a Full Risk Check, or explain risk metrics.",
        actions=[]
    )
