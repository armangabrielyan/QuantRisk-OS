
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import re

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
    
    # Detect language preference
    is_ru = bool(re.search('[а-яА-Я]', q))
    
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
        
    elif any(k in q for k in ["biggest risk", "largest risk", "главный риск", "самый большой риск", "основной риск"]):
        msg = "Ваши основные риски связаны с высокой утилизацией VaR в технологическом секторе." if is_ru else "Your largest risks currently stem from high VaR utilization in the technology sector."
        return AssistantResponse(message=msg, actions=[Action(label="Посмотреть Portfolio Risk" if is_ru else "Check Portfolio Risk", route="/portfolio")])
        
    elif any(k in q for k in ["liquidity", "ликвидность", "ликвидности"]):
        msg = "Переход к анализу ALM и Ликвидности." if is_ru else "Navigating to ALM & Liquidity analysis."
        return AssistantResponse(message=msg, actions=[Action(label="Открыть ALM & Liquidity" if is_ru else "Open ALM & Liquidity", route="/alm-liquidity")])
        
    elif any(k in q for k in ["contribute", "contribution", "влияют", "вклад"]):
        msg = "Чтобы увидеть, какие позиции вносят наибольший вклад в VaR, откройте Portfolio Analytics." if is_ru else "To see which positions contribute most to VaR, open Portfolio Analytics."
        return AssistantResponse(message=msg, actions=[Action(label="Открыть Portfolio Analytics" if is_ru else "Open Portfolio Analytics", route="/portfolio")])
        
    elif any(k in q for k in ["stress", "стресс", "шок"]):
        msg = "Рекомендуемые инструменты:
ALM & Liquidity → DV01
Stress Testing → Custom Scenario" if is_ru else "Recommended tools:
ALM & Liquidity → DV01
Stress Testing → Custom Scenario"
        return AssistantResponse(
            message=msg,
            actions=[
                Action(label="Открыть DV01" if is_ru else "Open DV01", route="/alm-liquidity"),
                Action(label="Открыть Stress Testing" if is_ru else "Open Stress Testing", route="/stress-testing")
            ]
        )
    elif any(k in q for k in ["limit", "лимит"]):
        msg = "Показываю контрагентов, близких к лимитам." if is_ru else "Showing counterparties close to their limits."
        return AssistantResponse(message=msg, actions=[Action(label="Открыть Лимиты" if is_ru else "Open Risk Limits", route="/limits")])
        
    elif any(k in q for k in ["compare", "сравнить", "со вчера", "прошл"]):
        msg = "Вы можете сравнить исторические метрики VaR в модуле Market Risk." if is_ru else "You can compare historical VaR metrics in the Market Risk module."
        return AssistantResponse(message=msg, actions=[Action(label="Открыть Market Risk" if is_ru else "Open Market Risk", route="/market-risk")])
        
    elif any(k in q for k in ["committee", "комитет", "отчет", "report"]):
        msg = "Подготовка отчета для Комитета по рискам." if is_ru else "Preparing a Risk Committee Report."
        return AssistantResponse(message=msg, actions=[Action(label="Открыть Отчеты" if is_ru else "Open Reports", route="/reports")])
        
    # NEW RULES specifically for trades / general risk calculation queries
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
        
    elif any(k in q for k in ["var", "вар"]):
        return AssistantResponse(
            message="Market Risk → VaR",
            actions=[Action(label="Открыть Market Risk" if is_ru else "Open Market Risk", route="/market-risk")]
        )
    
    # Smarter Fallback
    fallback_ru = "Я пока не уверен, какой именно модуль вам нужен.
Для расчета общих рыночных рисков используйте **Market Risk**.
Для анализа влияния конкретной сделки — **Portfolio Analytics**."
    fallback_en = "I'm not exactly sure which module you need.
For general market risks, use **Market Risk**.
To analyze a specific trade's impact, use **Portfolio Analytics**."
    
    return AssistantResponse(
        message=fallback_ru if is_ru else fallback_en,
        actions=[
            Action(label="Перейти в Market Risk" if is_ru else "Open Market Risk", route="/market-risk"),
            Action(label="Перейти в Portfolio Risk" if is_ru else "Open Portfolio Analytics", route="/portfolio")
        ]
    )
