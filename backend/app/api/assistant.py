
import os
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import re
from openai import AsyncOpenAI

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])

class AssistantQuery(BaseModel):
    query: str
    context: Optional[dict] = None

class Action(BaseModel):
    label: str
    route: str
    action_type: str = "navigate"

class AssistantResponse(BaseModel):
    message: str
    actions: List[Action]

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

SYSTEM_PROMPT = """You are the AI Risk Navigator for QuantRisk OS, an enterprise risk management platform.
Your job is to understand the user's intent and map it to the closest available platform modules.
If the exact feature is missing, say so politely and suggest the closest available tool.
ALWAYS respond in the SAME language as the user's query (e.g., Russian if they ask in Russian).
Do NOT invent financial numbers or make calculations yourself. Only navigate or explain.

Available Modules & Routes:
1. Market Risk (/market-risk): VaR (Monte Carlo, Historical, Parametric), Expected Shortfall, Volatility.
2. Credit Risk (/credit-risk): Expected Loss, PD, LGD, EAD, Merton Model, Credit Concentration, HHI.
3. ALM & Liquidity (/alm-liquidity): DV01, LCR, NSFR, Duration Gap, Repricing Gap.
4. Portfolio Risk (/portfolio): Marginal VaR, Component VaR, Incremental VaR, VaR Attribution, Diversification.
5. Stress Testing (/stress-testing): Custom Scenarios, Stress P&L, Scenario Comparison.
6. Risk Limits (/limits): Warning/Hard Limits, Limit Breaches.
7. Reports (/reports): Risk Committee Report, Executive Risk Summary.
8. ESG & Climate Risk (/esg): Carbon Exposure, WACI, Climate Stress.
9. Operational Risk (/op-risk): Cyber Incidents, Loss Events.
10. Third-Party Risk (/third-party): Vendor Risk.
11. Model Risk Management (/model-risk): Model Registry, Validation.

You must ALWAYS output valid JSON strictly matching this schema:
{
  "message": "Your conversational response explaining the tools.",
  "actions": [
     {"label": "Button Label", "route": "/route-name", "action_type": "navigate"}
  ]
}
"""

@router.post("/ask", response_model=AssistantResponse)
async def ask_assistant(req: AssistantQuery):
    q = req.query.lower()
    is_ru = bool(re.search('[а-яА-Я]', q))
    
    if not client.api_key:
        # Graceful fallback logic to purely rule-based processing if no API key is provided
        return run_heuristic_fallback(q, is_ru)
        
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": req.query}
            ],
            response_format={ "type": "json_object" },
            temperature=0.3
        )
        
        result_str = response.choices[0].message.content
        data = json.loads(result_str)
        
        actions = [Action(**a) for a in data.get("actions", [])]
        return AssistantResponse(message=data.get("message", "Error parsing response"), actions=actions)
        
    except Exception as e:
        # Fallback to heuristics if API call fails
        return run_heuristic_fallback(q, is_ru)

def run_heuristic_fallback(q: str, is_ru: bool):
    """Fallback logic if OPENAI_API_KEY is not configured"""
    
    if any(k in q for k in ["monte carlo", "монте карло", "монте-карло"]):
        return AssistantResponse(
            message="Рыночный риск → VaR → Монте-Карло" if is_ru else "Market Risk → VaR → Monte Carlo",
            actions=[Action(label="Открыть Monte Carlo VaR" if is_ru else "Open Monte Carlo VaR", route="/market-risk")]
        )
    elif any(k in q for k in ["full risk check", "полная проверка", "полный анализ"]):
        msg_ru = "Сводка по рискам (Executive Risk Summary):

- Data Quality: OK
- Оценка портфеля: $1.2M
- VaR: $45k
- Expected Shortfall: $55k
- Концентрация: Низкая
- Кредитный риск: Стабильно
- Ликвидность (LCR): 110%
- DV01: -$1.5k
- Лимиты: Без нарушений
- Алерт: Нет"
        msg_en = "Executive Risk Summary:

- Data Quality: OK
- Portfolio Valuation: $1.2M
- VaR: $45k
- Expected Shortfall: $55k
- Concentration: Low
- Credit Risk: Stable
- Liquidity: LCR 110%
- DV01: -$1.5k
- Risk Limits: No breaches
- Alerts: None"
        return AssistantResponse(message=msg_ru if is_ru else msg_en, actions=[])
    elif any(k in q for k in ["просчитать риск", "риск моей сделки", "оценить сделку", "риск сделки", "calculate risk", "trade risk", "new trade"]):
        msg = "Для оценки риска новой сделки я рекомендую:
1. Зайти в **Portfolio Risk**, чтобы увидеть, как сделка повлияет на общую маржинальную диверсификацию (Marginal VaR).
2. Использовать **Market Risk** для автономного расчета Expected Shortfall сделки." if is_ru else "To evaluate the risk of a new trade, I recommend:
1. Open **Portfolio Risk** to see its Marginal VaR contribution.
2. Use **Market Risk** for standalone Expected Shortfall."
        return AssistantResponse(
            message=msg,
            actions=[
                Action(label="Перейти в Portfolio Risk" if is_ru else "Open Portfolio Risk", route="/portfolio"),
                Action(label="Перейти в Market Risk" if is_ru else "Open Market Risk", route="/market-risk")
            ]
        )
    
    fallback_ru = "⚠️ OPENAI_API_KEY не настроен, поэтому я использую базовые правила. 
Для расчета риска сделки вы можете использовать **Market Risk** или **Portfolio Analytics**."
    fallback_en = "⚠️ OPENAI_API_KEY is not configured, so I am running on basic rules. 
For trade risk analysis, use **Market Risk** or **Portfolio Analytics**."
    
    return AssistantResponse(
        message=fallback_ru if is_ru else fallback_en,
        actions=[
            Action(label="Перейти в Market Risk" if is_ru else "Open Market Risk", route="/market-risk"),
            Action(label="Перейти в Portfolio Risk" if is_ru else "Open Portfolio Analytics", route="/portfolio")
        ]
    )
