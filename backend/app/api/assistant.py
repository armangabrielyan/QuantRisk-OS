
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

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

@router.post("/ask", response_model=AssistantResponse)
async def ask_assistant(req: AssistantQuery):
    q = req.query.lower()
    
    if "monte carlo" in q or "монте карло" in q or "монте-карло" in q:
        return AssistantResponse(
            message="Market Risk → VaR → Monte Carlo" if "monte" in q else "Рыночный риск → VaR → Монте-Карло",
            actions=[Action(label="Open Monte Carlo VaR", route="/market-risk")]
        )
    elif "full risk check" in q or "полная проверка" in q or "полный анализ" in q:
        return AssistantResponse(
            message="Executive Risk Summary:

- Data Quality: OK
- Portfolio Valuation: $1.2M
- VaR: $45k
- Expected Shortfall: $55k
- Concentration: Low
- Credit Risk: Stable
- Liquidity: LCR 110%
- DV01: -$1.5k
- Risk Limits: No breaches
- Alerts: None",
            actions=[]
        )
    elif any(k in q for k in ["biggest risk", "largest risk", "главный риск", "самый большой риск", "основной риск"]):
        return AssistantResponse(
            message="Your largest risks currently stem from high VaR utilization in the technology sector. / Ваши основные риски связаны с высокой утилизацией VaR в технологическом секторе.",
            actions=[Action(label="Check Portfolio Risk", route="/portfolio")]
        )
    elif any(k in q for k in ["liquidity", "ликвидность", "ликвидности"]):
        return AssistantResponse(
            message="Navigating to ALM & Liquidity analysis. / Переход к анализу ALM и Ликвидности.",
            actions=[Action(label="Open ALM & Liquidity", route="/alm-liquidity")]
        )
    elif any(k in q for k in ["contribute", "contribution", "влияют", "вклад"]):
        return AssistantResponse(
            message="To see which positions contribute most to VaR, open Portfolio Analytics. / Чтобы увидеть, какие позиции вносят наибольший вклад в VaR, откройте Portfolio Analytics.",
            actions=[Action(label="Open Portfolio Analytics", route="/portfolio")]
        )
    elif any(k in q for k in ["stress", "стресс", "шок"]):
        return AssistantResponse(
            message="Recommended tools:
ALM & Liquidity → DV01
Stress Testing → Custom Scenario",
            actions=[
                Action(label="Open DV01", route="/alm-liquidity"),
                Action(label="Open Stress Testing", route="/stress-testing")
            ]
        )
    elif any(k in q for k in ["limit", "лимит"]):
        return AssistantResponse(
            message="Showing counterparties close to their limits. / Показываю контрагентов, близких к лимитам.",
            actions=[Action(label="Open Risk Limits", route="/limits")]
        )
    elif any(k in q for k in ["compare", "сравнить", "со вчера", "прошл"]):
        return AssistantResponse(
            message="You can compare historical VaR metrics in the Market Risk module. / Вы можете сравнить исторические метрики VaR в модуле Market Risk.",
            actions=[Action(label="Open Market Risk", route="/market-risk")]
        )
    elif any(k in q for k in ["committee", "комитет", "отчет", "report"]):
        return AssistantResponse(
            message="Preparing a Risk Committee Report. / Подготовка отчета для Комитета по рискам.",
            actions=[Action(label="Open Reports", route="/reports")]
        )
    elif any(k in q for k in ["var", "вар"]):
        return AssistantResponse(
            message="Market Risk → VaR",
            actions=[Action(label="Open Market Risk", route="/market-risk")]
        )
    
    # Fallback for knowledge base / unknown queries
    return AssistantResponse(
        message="This function is not currently available in the platform. / Эта функция в данный момент недоступна на платформе.

I am a specialized Risk Assistant. I can help you with:
- Calculating VaR & Stress Tests
- Finding Risk Tools
- Generating Committee Reports",
        actions=[]
    )
