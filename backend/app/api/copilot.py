
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.database.session import get_db
from app.models.orm_models import RiskHistory
import re

router = APIRouter(prefix="/api/copilot", tags=["Copilot"])

class CopilotQuery(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class CopilotResponse(BaseModel):
    answer: str

@router.post("/ask", response_model=CopilotResponse)
async def ask_copilot(req: CopilotQuery, db: Session = Depends(get_db)):
    q = req.query.lower()
    is_ru = bool(re.search('[а-яА-Я]', q))
    
    histories = db.query(RiskHistory).order_by(RiskHistory.date.desc()).limit(2).all()
    curr_metrics = histories[0].metrics if len(histories) > 0 else {}
    prev_metrics = histories[1].metrics if len(histories) > 1 else {}
    
    insufficient_msg = "Недостаточно данных в базе для ответа на этот вопрос. Пожалуйста, запустите расчеты в системе." if is_ru else "Insufficient data to determine the cause."
    
    if any(k in q for k in ["why did var increase", "why did var change", "почему вырос var", "почему изменился var", "вар"]):
        if not curr_metrics or not prev_metrics:
            return {"answer": insufficient_msg}
        curr_var = curr_metrics.get("market_risk", {}).get("var_1d_99", 0)
        prev_var = prev_metrics.get("market_risk", {}).get("var_1d_99", 0)
        if curr_var > prev_var:
             return {"answer": f"VaR вырос с {prev_var} до {curr_var}." if is_ru else f"VaR increased from {prev_var} to {curr_var}."}
        elif curr_var < prev_var:
             return {"answer": f"VaR на самом деле снизился с {prev_var} до {curr_var}." if is_ru else f"VaR actually decreased from {prev_var} to {curr_var}."}
        else:
             return {"answer": "VaR не изменился." if is_ru else "VaR did not change."}
             
    elif any(k in q for k in ["largest risks", "biggest risk", "главные риски", "самый большой риск", "мои риски"]):
        risks = []
        if curr_metrics.get("market_risk", {}).get("var_utilization", 0) > 0.8:
            risks.append("Высокая утилизация VaR" if is_ru else "High VaR utilization")
        if curr_metrics.get("credit_risk", {}).get("el_pct_of_ead", 0) > 2.0:
            risks.append("Высокий ожидаемый убыток" if is_ru else "High Expected Loss")
        if risks:
            ans = "На основе последних расчетов главные риски: " if is_ru else "Based on data, largest risks: "
            return {"answer": ans + ", ".join(risks)}
        return {"answer": insufficient_msg}
        
    elif any(k in q for k in ["limits are breached", "пробиты лимиты", "нарушены лимиты"]):
        breaches = []
        if curr_metrics.get("market_risk", {}).get("var_1d_99", 0) > curr_metrics.get("market_risk", {}).get("var_limit", 1e9):
            breaches.append("Лимит VaR" if is_ru else "VaR limit")
        if breaches:
            ans = "Нарушены следующие лимиты: " if is_ru else "The following limits are breached: "
            return {"answer": ans + ", ".join(breaches)}
        return {"answer": "В данный момент лимиты не нарушены." if is_ru else "No limits are currently breached."}
        
    elif any(k in q for k in ["positions contribute", "влияют на", "вклад", "позици"]):
        positions = curr_metrics.get("positions", [])
        if not positions:
            return {"answer": insufficient_msg}
        sorted_pos = sorted(positions, key=lambda x: x.get("var_contribution", 0), reverse=True)
        top = [f"{p.get('symbol', 'Unknown')} ({p.get('var_contribution', 0)})" for p in sorted_pos[:3]]
        ans = "Позиции с самым большим вкладом в VaR: " if is_ru else "Top contributors to VaR: "
        return {"answer": ans + ", ".join(top)}
        
    elif any(k in q for k in ["stress scenarios", "стресс", "шок"]):
        if "stress_test" in curr_metrics and curr_metrics["stress_test"]:
            sc = curr_metrics['stress_test'].get('scenario_name', 'Unknown')
            loss = curr_metrics['stress_test'].get('total_loss', 0)
            return {"answer": f"При сценарии {sc} общий убыток составил {loss}." if is_ru else f"Under scenario {sc}, total loss was {loss}."}
        return {"answer": insufficient_msg}
        
    elif any(k in q for k in ["expected loss change", "изменился el", "expected loss"]):
        if not curr_metrics or not prev_metrics:
            return {"answer": insufficient_msg}
        curr_el = curr_metrics.get("credit_risk", {}).get("total_el", 0)
        prev_el = prev_metrics.get("credit_risk", {}).get("total_el", 0)
        if curr_el != prev_el:
            return {"answer": f"Expected Loss изменился с {prev_el} до {curr_el}." if is_ru else f"Expected Loss changed from {prev_el} to {curr_el}."}
        return {"answer": insufficient_msg}
        
    elif any(k in q for k in ["changed since yesterday", "со вчера", "изменилось"]):
        if not curr_metrics or not prev_metrics:
            return {"answer": insufficient_msg}
        curr_var = curr_metrics.get("market_risk", {}).get("var_1d_99", 0)
        prev_var = prev_metrics.get("market_risk", {}).get("var_1d_99", 0)
        curr_el = curr_metrics.get("credit_risk", {}).get("total_el", 0)
        prev_el = prev_metrics.get("credit_risk", {}).get("total_el", 0)
        return {"answer": f"Со вчерашнего дня VaR изменился с {prev_var} до {curr_var}, а Expected Loss с {prev_el} до {curr_el}." if is_ru else f"Since yesterday, VaR changed from {prev_var} to {curr_var} and Expected Loss changed from {prev_el} to {curr_el}."}
        
    elif any(k in q for k in ["committee commentary", "для комитета", "сводка"]):
        if not curr_metrics:
            return {"answer": insufficient_msg}
        utilization = curr_metrics.get("market_risk", {}).get("var_utilization", 0) * 100
        lcr = curr_metrics.get("liquidity", {}).get("lcr", 0) * 100
        return {"answer": f"Утилизация лимита VaR составляет {utilization:.1f}%. Показатель LCR равен {lcr:.1f}%." if is_ru else f"Portfolio VaR utilization is at {utilization:.1f}%. LCR is at {lcr:.1f}%."}
        
    fallback = "Я аналитический Copilot, работающий строго на основе сохраненных метрик БД, поэтому не могу дать общий ответ.

Задайте вопрос о сохраненных данных (например, «почему изменился VaR»)." if is_ru else "I am an analytical Copilot strictly relying on saved DB metrics, so I cannot provide general advice.

Ask me about saved metrics (e.g., 'why did VaR change')."
    return {"answer": fallback}
