from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from app.database.session import get_db
from app.models.orm_models import RiskHistory

router = APIRouter(prefix="/api/copilot", tags=["Copilot"])

class CopilotQuery(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class CopilotResponse(BaseModel):
    answer: str

@router.post("/ask", response_model=CopilotResponse)
async def ask_copilot(req: CopilotQuery, db: Session = Depends(get_db)):
    query = req.query.lower()
    
    # Fetch risk history from DB to provide context
    histories = db.query(RiskHistory).order_by(RiskHistory.date.desc()).limit(2).all()
    
    curr_metrics = histories[0].metrics if len(histories) > 0 else {}
    prev_metrics = histories[1].metrics if len(histories) > 1 else {}
    
    context = req.context or {}
    
    if "why did var increase?" in query or "why did var change" in query:
        if not curr_metrics or not prev_metrics:
            return {"answer": "Insufficient data to determine the cause."}
        curr_var = curr_metrics.get("market_risk", {}).get("var_1d_99", 0)
        prev_var = prev_metrics.get("market_risk", {}).get("var_1d_99", 0)
        if curr_var > prev_var:
             return {"answer": f"VaR increased from {prev_var} to {curr_var} based on the provided metrics."}
        elif curr_var < prev_var:
             return {"answer": f"VaR actually decreased from {prev_var} to {curr_var}."}
        else:
             return {"answer": "VaR did not change according to the historical data."}
             
    elif "largest risks" in query:
        risks = []
        if curr_metrics.get("market_risk", {}).get("var_utilization", 0) > 0.8:
            risks.append("High VaR utilization")
        if curr_metrics.get("credit_risk", {}).get("el_pct_of_ead", 0) > 2.0:
            risks.append("High Expected Loss")
        if risks:
            return {"answer": f"Based on the data, the largest risks are: {', '.join(risks)}."}
        return {"answer": "Insufficient data to determine the cause."}
        
    elif "limits are breached" in query:
        breaches = []
        if curr_metrics.get("market_risk", {}).get("var_1d_99", 0) > curr_metrics.get("market_risk", {}).get("var_limit", 1e9):
            breaches.append("VaR limit")
        if breaches:
            return {"answer": f"The following limits are breached: {', '.join(breaches)}."}
        return {"answer": "No limits are currently breached."}
        
    elif "positions contribute most to var" in query:
        positions = curr_metrics.get("positions", [])
        if not positions:
            return {"answer": "Insufficient data to determine the cause."}
        sorted_pos = sorted(positions, key=lambda x: x.get("var_contribution", 0), reverse=True)
        top = [f"{p.get('symbol', 'Unknown')} ({p.get('var_contribution', 0)})" for p in sorted_pos[:3]]
        return {"answer": f"The top contributors to VaR are: {', '.join(top)}."}
        
    elif "stress scenarios" in query:
        if "stress_test" in curr_metrics and curr_metrics["stress_test"]:
            return {"answer": f"Under stress scenario {curr_metrics['stress_test'].get('scenario_name', 'Unknown')}, total loss was {curr_metrics['stress_test'].get('total_loss', 0)}."}
        return {"answer": "Insufficient data to determine the cause."}
        
    elif "expected loss change" in query:
        if not curr_metrics or not prev_metrics:
            return {"answer": "Insufficient data to determine the cause."}
        curr_el = curr_metrics.get("credit_risk", {}).get("total_el", 0)
        prev_el = prev_metrics.get("credit_risk", {}).get("total_el", 0)
        if curr_el != prev_el:
            return {"answer": f"Expected Loss changed from {prev_el} to {curr_el}."}
        return {"answer": "Insufficient data to determine the cause."}
        
    elif "changed since yesterday" in query:
        if not curr_metrics or not prev_metrics:
            return {"answer": "Insufficient data to determine the cause."}
        curr_var = curr_metrics.get("market_risk", {}).get("var_1d_99", 0)
        prev_var = prev_metrics.get("market_risk", {}).get("var_1d_99", 0)
        curr_el = curr_metrics.get("credit_risk", {}).get("total_el", 0)
        prev_el = prev_metrics.get("credit_risk", {}).get("total_el", 0)
        return {"answer": f"Since yesterday, VaR changed from {prev_var} to {curr_var} and Expected Loss changed from {prev_el} to {curr_el}."}
        
    elif "risk committee commentary" in query:
        if not curr_metrics:
            return {"answer": "Insufficient data to determine the cause."}
        utilization = curr_metrics.get("market_risk", {}).get("var_utilization", 0) * 100
        lcr = curr_metrics.get("liquidity", {}).get("lcr", 0) * 100
        return {"answer": f"Portfolio VaR utilization is at {utilization:.1f}%. LCR is at {lcr:.1f}%."}
        
    return {"answer": "Insufficient data to determine the cause."}
