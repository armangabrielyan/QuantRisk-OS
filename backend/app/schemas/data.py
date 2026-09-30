from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class InstrumentBase(BaseModel):
    internal_id: str
    ticker: str
    isin: Optional[str] = None
    figi_cusip: Optional[str] = None
    currency: str = "USD"
    asset_class: str
    sector: Optional[str] = None
    country: Optional[str] = None
    issuer: Optional[str] = None
    rating: Optional[str] = None
    maturity: Optional[datetime] = None
    provider_symbols: Optional[Dict[str, Any]] = None

class InstrumentCreate(InstrumentBase):
    pass

class InstrumentResponse(InstrumentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MarketDataBase(BaseModel):
    instrument_id: int
    provider: str
    timestamp: datetime
    price: Optional[float] = None
    volume: Optional[float] = None
    status: str = "LIVE"
    source_priority: int = 1

class MarketDataCreate(MarketDataBase):
    pass

class MarketDataResponse(MarketDataBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DataQualityReport(BaseModel):
    instrument_id: int
    missing_data: bool
    stale_prices: bool
    invalid_prices: bool
    outliers: bool
    duplicates: bool
    missing_metadata: bool
    insufficient_history: bool
    details: Dict[str, Any]
