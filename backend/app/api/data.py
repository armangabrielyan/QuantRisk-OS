"""QuantRisk OS - Market Data API Router

Fetches market data via yfinance with local fallback sample datasets.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import numpy as np

router = APIRouter(prefix="/api/data", tags=["Market Data"])

# ---------------------------------------------------------------------------
# Offline Sample Data (deterministic, fixed seed)
# Generated to mimic realistic daily log-returns for major instruments.
# ---------------------------------------------------------------------------

def _generate_sample_returns(ticker: str, n: int = 504) -> dict:
    """Generate deterministic realistic sample returns for a ticker."""
    seeds = {
        "SPY": 42, "GLD": 43, "TLT": 44, "JPM": 45, "BAC": 46,
        "QQQ": 47, "IEF": 48, "GS": 49, "C": 50, "XLF": 51,
    }
    params = {
        "SPY": (0.0004, 0.0110),   # S&P 500: +10% annual, 17% vol
        "GLD": (0.0002, 0.0090),   # Gold: +5% annual, 14% vol
        "TLT": (-0.0002, 0.0095),  # Long-term Treasury (rate-rise environment)
        "JPM": (0.0005, 0.0145),   # JPMorgan: higher vol, higher return
        "BAC": (0.0004, 0.0155),   # Bank of America
        "QQQ": (0.0006, 0.0130),   # NASDAQ-100
        "IEF": (0.0001, 0.0050),   # 7-10yr Treasury
        "GS": (0.0005, 0.0140),    # Goldman Sachs
        "C": (0.0003, 0.0160),     # Citigroup
        "XLF": (0.0004, 0.0120),   # Financial sector ETF
    }
    seed = seeds.get(ticker, hash(ticker) % 10000)
    mu, sigma = params.get(ticker, (0.0003, 0.0120))

    rng = np.random.default_rng(seed)
    # Add some autocorrelation and volatility clustering (simplified)
    returns = rng.normal(mu, sigma, n)
    # Introduce a couple of stress periods
    stress_start = n // 3
    returns[stress_start:stress_start + 20] *= 3.0  # stress episode

    # Simple price reconstruction
    prices = 100.0 * np.cumprod(1 + returns)

    # Dates: approximately 2 years of trading days ending today
    import datetime
    today = datetime.date.today()
    dates = []
    d = today - datetime.timedelta(days=int(n * 1.4))
    count = 0
    while count < n:
        if d.weekday() < 5:  # weekdays only
            dates.append(str(d))
            count += 1
        d += datetime.timedelta(days=1)

    return {
        "returns": returns.tolist(),
        "prices": prices.tolist(),
        "dates": dates[:n],
        "n": n,
        "mu": float(mu),
        "sigma": float(sigma),
    }


SAMPLE_TICKERS = ["SPY", "GLD", "TLT", "JPM", "BAC", "QQQ", "IEF", "GS", "C", "XLF"]

_SAMPLE_CACHE: dict = {}


def _get_cached_sample(ticker: str, n: int = 504) -> dict:
    key = f"{ticker}_{n}"
    if key not in _SAMPLE_CACHE:
        _SAMPLE_CACHE[key] = _generate_sample_returns(ticker, n)
    return _SAMPLE_CACHE[key]


@router.get("/sample-tickers")
async def get_sample_tickers():
    """Return list of available sample tickers."""
    return {
        "status": "success",
        "data": {
            "tickers": SAMPLE_TICKERS,
            "note": "These tickers have deterministic offline sample data available.",
        },
    }


@router.get("/fetch")
async def fetch_market_data(
    ticker: str = Query(..., description="Ticker symbol, e.g. SPY"),
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    interval: str = Query("1d", description="Data interval"),
):
    """
    Fetch market data. Attempts yfinance first; falls back to sample data.

    Response clearly indicates LIVE DATA or OFFLINE SAMPLE DATA.
    """
    ticker = ticker.upper().strip()

    # Try yfinance
    try:
        import yfinance as yf
        import pandas as pd

        t = yf.Ticker(ticker)
        hist = t.history(start=start, end=end, interval=interval, auto_adjust=True)

        if hist.empty:
            raise ValueError(f"No data returned for {ticker}")

        prices = hist["Close"].dropna()
        if len(prices) < 10:
            raise ValueError("Insufficient data points")

        returns = prices.pct_change().dropna()
        dates = [str(d.date()) for d in returns.index]

        return {
            "status": "success",
            "data": {
                "ticker": ticker,
                "source": "LIVE DATA",
                "returns": returns.tolist(),
                "prices": prices.iloc[1:].tolist(),
                "dates": dates,
                "n": len(returns),
                "metadata": {
                    "start": dates[0] if dates else None,
                    "end": dates[-1] if dates else None,
                    "interval": interval,
                    "currency": "USD",
                },
            },
        }
    except Exception as live_err:
        # Fallback to sample data
        sample = _get_cached_sample(ticker if ticker in SAMPLE_TICKERS else "SPY")
        effective_ticker = ticker if ticker in SAMPLE_TICKERS else "SPY"

        return {
            "status": "success",
            "data": {
                "ticker": effective_ticker,
                "requested_ticker": ticker,
                "source": "OFFLINE SAMPLE DATA",
                "source_reason": str(live_err),
                "returns": sample["returns"],
                "prices": sample["prices"],
                "dates": sample["dates"],
                "n": sample["n"],
                "metadata": {
                    "start": sample["dates"][0],
                    "end": sample["dates"][-1],
                    "interval": "1d",
                    "note": "This is synthetic sample data, not real market prices.",
                },
            },
        }


@router.get("/sample/{ticker}")
async def get_sample_data(
    ticker: str,
    n: int = Query(504, ge=50, le=2000, description="Number of trading days"),
):
    """Return deterministic sample data for a ticker (always offline)."""
    ticker = ticker.upper()
    sample = _get_cached_sample(ticker if ticker in SAMPLE_TICKERS else "SPY", n)
    return {
        "status": "success",
        "data": {
            "ticker": ticker if ticker in SAMPLE_TICKERS else "SPY",
            "source": "OFFLINE SAMPLE DATA",
            "returns": sample["returns"],
            "prices": sample["prices"],
            "dates": sample["dates"],
            "n": sample["n"],
        },
    }

from fastapi import Depends, File, UploadFile
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.data import InstrumentCreate, InstrumentResponse, DataQualityReport
from app.services.data_architecture import InstrumentMasterService, MarketDataHubService, DataQualityCenterService

@router.post('/instrument', response_model=InstrumentResponse)
def create_instrument(instrument: InstrumentCreate, db: Session = Depends(get_db)):
    return InstrumentMasterService.create_instrument(db, instrument)

@router.get('/instrument/{ticker}', response_model=InstrumentResponse)
def get_instrument(ticker: str, db: Session = Depends(get_db)):
    inst = InstrumentMasterService.get_instrument(db, ticker)
    if not inst:
        raise HTTPException(status_code=404, detail='Instrument not found')
    return inst

@router.get('/market-hub/{ticker}')
def fetch_market_hub_data(ticker: str, start: str, end: str, db: Session = Depends(get_db)):
    try:
        return MarketDataHubService.fetch_data(db, ticker, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get('/quality/{ticker}', response_model=DataQualityReport)
def get_data_quality(ticker: str, db: Session = Depends(get_db)):
    return DataQualityCenterService.validate_instrument_data(db, ticker)
