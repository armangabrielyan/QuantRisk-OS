
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
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
    q = req.query.lower()
    
    # Fetch risk history from DB to provide context
    histories = db.query(RiskHistory).order_by(RiskHistory.date.desc()).limit(2).all()
    curr_metrics = histories[0].metrics if len(histories) > 0 else {}
    prev_metrics = histories[1].metrics if len(histories) > 1 else {}
    
    insufficient_msg = "Insufficient data to determine the cause. / Недостаточно данных для определения причины."
    
    if any(k in q for k in ["why did var increase", "why did var change", "почему вырос var", "почему изменился var", "вар"]):
        if not curr_metrics or not prev_metrics:
            return {"answer": insufficient_msg}
        curr_var = curr_metrics.get("market_risk", {}).get("var_1d_99", 0)
        prev_var = prev_metrics.get("market_risk", {}).get("var_1d_99", 0)
        if curr_var > prev_var:
             return {"answer": f"VaR increased from {prev_var} to {curr_var} based on the provided metrics. / VaR вырос с {prev_var} до {curr_var} на основе исторических данных."}
        elif curr_var < prev_var:
             return {"answer": f"VaR actually decreased from {prev_var} to {curr_var}. / VaR на самом деле снизился с {prev_var} до {curr_var}."}
        else:
             return {"answer": "VaR did not change according to the historical data. / VaR не изменился."}
             
    elif any(k in q for k in ["largest risks", "biggest risk", "главные риски", "самый большой риск"]):
        risks = []
        if curr_metrics.get("market_risk", {}).get("var_utilization", 0) > 0.8:
            risks.append("High VaR utilization / Высокая утилизация VaR")
        if curr_metrics.get("credit_risk", {}).get("el_pct_of_ead", 0) > 2.0:
            risks.append("High Expected Loss / Высокий ожидаемый убыток")
        if risks:
            return {"answer": f"Based on the data, the largest risks are: {', '.join(risks)}."}
        return {"answer": insufficient_msg}
        
    elif any(k in q for k in ["limits are breached", "пробиты лимиты", "нарушены лимиты"]):
        breaches = []
        if curr_metrics.get("market_risk", {}).get("var_1d_99", 0) > curr_metrics.get("market_risk", {}).get("var_limit", 1e9):
            breaches.append("VaR limit")
        if breaches:
            return {"answer": f"The following limits are breached: {', '.join(breaches)}."}
        return {"answer": "No limits are currently breached. / В данный момент лимиты не нарушены."}
        
    elif any(k in q for k in ["positions contribute", "влияют на", "вклад", "позици"]):
        positions = curr_metrics.get("positions", [])
        if not positions:
            return {"answer": insufficient_msg}
        sorted_pos = sorted(positions, key=lambda x: x.get("var_contribution", 0), reverse=True)
        top = [f"{p.get('symbol', 'Unknown')} ({p.get('var_contribution', 0)})" for p in sorted_pos[:3]]
        return {"answer": f"The top contributors to VaR are: {', '.join(top)}."}
        
    elif any(k in q for k in ["stress scenarios", "стресс", "шок"]):
        if "stress_test" in curr_metrics and curr_metrics["stress_test"]:
            return {"answer": f"Under stress scenario {curr_metrics['stress_test'].get('scenario_name', 'Unknown')}, total loss was {curr_metrics['stress_test'].get('total_loss', 0)}."}
        return {"answer": insufficient_msg}
        
    elif any(k in q for k in ["expected loss change", "изменился el", "expected loss"]):
        if not curr_metrics or not prev_metrics:
            return {"answer": insufficient_msg}
        curr_el = curr_metrics.get("credit_risk", {}).get("total_el", 0)
        prev_el = prev_metrics.get("credit_risk", {}).get("total_el", 0)
        if curr_el != prev_el:
            return {"answer": f"Expected Loss changed from {prev_el} to {curr_el}. / Expected Loss изменился с {prev_el} до {curr_el}."}
        return {"answer": insufficient_msg}
        
    elif any(k in q for k in ["changed since yesterday", "со вчера", "изменилось"]):
        if not curr_metrics or not prev_metrics:
            return {"answer": insufficient_msg}
        curr_var = curr_metrics.get("market_risk", {}).get("var_1d_99", 0)
        prev_var = prev_metrics.get("market_risk", {}).get("var_1d_99", 0)
        curr_el = curr_metrics.get("credit_risk", {}).get("total_el", 0)
        prev_el = prev_metrics.get("credit_risk", {}).get("total_el", 0)
        return {"answer": f"Since yesterday, VaR changed from {prev_var} to {curr_var} and Expected Loss changed from {prev_el} to {curr_el}."}
        
    elif any(k in q for k in ["committee commentary", "для комитета", "сводка"]):
        if not curr_metrics:
            return {"answer": insufficient_msg}
        utilization = curr_metrics.get("market_risk", {}).get("var_utilization", 0) * 100
        lcr = curr_metrics.get("liquidity", {}).get("lcr", 0) * 100
        return {"answer": f"Portfolio VaR utilization is at {utilization:.1f}%. LCR is at {lcr:.1f}%."}
        
    return {"answer": "This function is not currently available in the platform. / Эта функция недоступна.
I am an analytical Copilot relying strictly on calculated database metrics. / Я аналитический Copilot, работающий строго поверх сохраненных метрик БД."}
