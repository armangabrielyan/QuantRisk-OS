from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import random
import time

router = APIRouter(prefix="/api/intelligence", tags=["Risk Intelligence"])

class RiskEvent(BaseModel):
    id: int
    title: str
    description: str
    date: str
    category: str
    impact: str
    tags: List[str]

# In-memory cache to avoid Google News rate limits (caches for 10 minutes)
NEWS_CACHE = {}
CACHE_TTL = 600 

def generate_mock_events():
    today = datetime.now()
    return [
        {
            "id": 1,
            "title": "Fed announces unexpected 50bps rate cut",
            "description": "The Federal Reserve surprised markets today by cutting the federal funds rate by 50 basis points to stimulate the economy amid slowing inflation.",
            "date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "category": "Macro",
            "impact": "High",
            "tags": ["Interest Rates", "USD", "Fed"]
        },
        {
            "id": 2,
            "title": "Moody's downgrades several regional banks",
            "description": "Rating agency Moody's downgraded the credit ratings of 10 US regional banks, citing deposit instability and commercial real estate exposure.",
            "date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "category": "Ratings",
            "impact": "High",
            "tags": ["Credit Risk", "Banking", "Downgrade"]
        },
        {
            "id": 3,
            "title": "Basel Committee publishes new ESG guidelines",
            "description": "New principles for the effective management and supervision of climate-related financial risks were issued today.",
            "date": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            "category": "Regulatory",
            "impact": "Medium",
            "tags": ["Basel", "ESG", "Compliance"]
        }
    ]

def determine_impact(title: str) -> str:
    title_lower = title.lower()
    high_keywords = ['crash', 'crisis', 'downgrade', 'cut', 'hike', 'emergency', 'war', 'default', 'plunge']
    if any(k in title_lower for k in high_keywords):
        return "High"
    medium_keywords = ['warns', 'rules', 'regulation', 'inflation', 'steady', 'grows', 'debt']
    if any(k in title_lower for k in medium_keywords):
        return "Medium"
    return "Low"

def extract_tags(title: str) -> List[str]:
    tags = []
    t = title.lower()
    if 'fed ' in t or 'federal reserve' in t: tags.append('Fed')
    if 'ecb ' in t: tags.append('ECB')
    if 'rate' in t: tags.append('Rates')
    if 'bank' in t: tags.append('Banking')
    if 'sec ' in t: tags.append('SEC')
    if 'basel' in t: tags.append('Basel')
    if 'moody' in t or 's&p' in t or 'fitch' in t: tags.append('RatingAgency')
    if not tags:
        tags.append('Global')
    return tags

def fetch_live_news(query: str, category_name: str) -> List[dict]:
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    events = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            for i, item in enumerate(root.findall('.//item')[:10]):
                title = item.find('title').text
                pub_date_str = item.find('pubDate').text
                source = item.find('source').text if item.find('source') is not None else "Financial News"
                
                try:
                    # Convert 'Thu, 30 Sep 2026 14:00:00 GMT'
                    dt = datetime.strptime(pub_date_str, "%a, %d %b %Y %H:%M:%S %Z")
                    date_formatted = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    date_formatted = pub_date_str
                
                # Clean up title (remove trailing source name typically separated by ' - ')
                clean_title = title.rsplit(' - ', 1)[0]
                
                events.append({
                    "id": int(time.time() * 1000) + i,
                    "title": clean_title,
                    "description": f"Source: {source}. Read full article for details on this {category_name.lower()} event.",
                    "date": date_formatted,
                    "category": category_name,
                    "impact": determine_impact(clean_title),
                    "tags": extract_tags(clean_title)
                })
        return events
    except Exception as e:
        print(f"Failed to fetch live news for {category_name}: {e}")
        return []

@router.get("/events")
async def get_events(category: Optional[str] = None):
    current_time = time.time()
    
    # Check cache
    cache_key = category if category else "All"
    if cache_key in NEWS_CACHE:
        cache_time, cached_data = NEWS_CACHE[cache_key]
        if current_time - cache_time < CACHE_TTL:
            return {"status": "success", "data": cached_data, "source": "live (cached)"}
            
    # Fetch live data
    all_events = []
    queries = {
        "Macro": "macroeconomics+central+bank+interest+rates",
        "Ratings": "credit+rating+downgrade+upgrade+S%26P+Moody",
        "Regulatory": "financial+regulation+basel+sec+compliance",
        "Market": "financial+markets+risk+volatility"
    }
    
    target_categories = [category] if category and category != "All" else queries.keys()
    
    for cat in target_categories:
        if cat in queries:
            events = fetch_live_news(queries[cat], cat)
            all_events.extend(events)
            
    # Sort by date (descending)
    all_events.sort(key=lambda x: x["date"], reverse=True)
    
    if not all_events:
        all_events = generate_mock_events()
        
    NEWS_CACHE[cache_key] = (current_time, all_events)
    return {"status": "success", "data": all_events, "source": "live"}
