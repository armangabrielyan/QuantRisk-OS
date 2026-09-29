from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/intelligence", tags=["Risk Intelligence"])

class RiskEvent(BaseModel):
    id: int
    title: str
    description: str
    date: str
    category: str
    impact: str
    tags: List[str]

MOCK_EVENTS = [
    {
        "id": 1,
        "title": "Fed announces unexpected 50bps rate cut",
        "description": "The Federal Reserve surprised markets today by cutting the federal funds rate by 50 basis points to stimulate the economy amid slowing inflation.",
        "date": "2024-03-15",
        "category": "Macro",
        "impact": "High",
        "tags": ["Interest Rates", "USD", "Fed"]
    },
    {
        "id": 2,
        "title": "Moody's downgrades several regional banks",
        "description": "Rating agency Moody's downgraded the credit ratings of 10 US regional banks, citing deposit instability and commercial real estate exposure.",
        "date": "2024-03-10",
        "category": "Ratings",
        "impact": "High",
        "tags": ["Credit Risk", "Banking", "Downgrade"]
    },
    {
        "id": 3,
        "title": "Basel Committee publishes new ESG guidelines",
        "description": "New principles for the effective management and supervision of climate-related financial risks were issued today.",
        "date": "2024-03-05",
        "category": "Regulatory",
        "impact": "Medium",
        "tags": ["Basel", "ESG", "Compliance"]
    },
    {
        "id": 4,
        "title": "ECB maintains current interest rates",
        "description": "The European Central Bank opted to keep interest rates steady, maintaining a restrictive monetary stance to ensure inflation returns to 2%.",
        "date": "2024-03-01",
        "category": "Macro",
        "impact": "Medium",
        "tags": ["ECB", "EUR", "Rates"]
    },
    {
        "id": 5,
        "title": "S&P puts Tech Giant X on CreditWatch Negative",
        "description": "Following weak quarterly earnings and increased debt issuance, S&P has placed the BBB+ rating of Tech Giant X on CreditWatch Negative.",
        "date": "2024-02-28",
        "category": "Ratings",
        "impact": "Low",
        "tags": ["Corporate", "Tech", "CreditWatch"]
    },
    {
        "id": 6,
        "title": "SEC adopts new cybersecurity disclosure rules",
        "description": "Public companies are now required to disclose material cybersecurity incidents within 4 days under the new SEC rules.",
        "date": "2024-02-20",
        "category": "Regulatory",
        "impact": "Medium",
        "tags": ["SEC", "Cyber", "OpRisk"]
    }
]

@router.get("/events")
async def get_events(category: Optional[str] = None):
    if category and category != "All":
        filtered = [e for e in MOCK_EVENTS if e["category"].lower() == category.lower()]
        return {"status": "success", "data": filtered}
    return {"status": "success", "data": MOCK_EVENTS}
