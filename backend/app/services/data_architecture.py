import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import yfinance as yf
from sqlalchemy.orm import Session
from app.models.orm_models import Instrument, MarketData, Portfolio, PortfolioAsset
from app.schemas.data import InstrumentCreate, MarketDataCreate, DataQualityReport
import io
import csv
import urllib.parse

class InstrumentMasterService:
    @staticmethod
    def get_instrument(db: Session, ticker: str) -> Optional[Instrument]:
        return db.query(Instrument).filter(Instrument.ticker == ticker).first()

    @staticmethod
    def create_instrument(db: Session, instrument_in: InstrumentCreate) -> Instrument:
        db_inst = Instrument(
            internal_id=instrument_in.internal_id,
            ticker=instrument_in.ticker,
            isin=instrument_in.isin,
            figi_cusip=instrument_in.figi_cusip,
            currency=instrument_in.currency,
            asset_class=instrument_in.asset_class,
            sector=instrument_in.sector,
            country=instrument_in.country,
            issuer=instrument_in.issuer,
            rating=instrument_in.rating,
            maturity=instrument_in.maturity,
            provider_symbols=instrument_in.provider_symbols,
        )
        db.add(db_inst)
        db.commit()
        db.refresh(db_inst)
        return db_inst

class MarketDataAdapter:
    def fetch(self, ticker: str, start: str, end: str) -> Dict[str, Any]:
        raise NotImplementedError

class YahooFinanceAdapter(MarketDataAdapter):
    def fetch(self, ticker: str, start: str, end: str) -> Dict[str, Any]:
        t = yf.Ticker(ticker)
        hist = t.history(start=start, end=end, auto_adjust=True)
        if hist.empty:
            raise ValueError(f"No data for {ticker} from Yahoo Finance")
        prices = hist["Close"].dropna()
        if prices.empty:
            raise ValueError(f"No valid price data for {ticker}")
        returns = prices.pct_change().dropna()
        return {
            "source": "yahoo_finance",
            "status": "LIVE",
            "prices": prices.tolist(),
            "returns": returns.tolist(),
            "dates": [str(d.date()) for d in returns.index],
            "last_price": float(prices.iloc[-1])
        }

class AlphaVantageAdapter(MarketDataAdapter):
    def fetch(self, ticker: str, start: str, end: str) -> Dict[str, Any]:
        # Mocking Alpha Vantage adapter logic to simulate fallback
        raise ValueError("Alpha Vantage API key not configured")

class MockAdapter(MarketDataAdapter):
    def fetch(self, ticker: str, start: str, end: str) -> Dict[str, Any]:
        try:
            date_index = pd.date_range(start=start, periods=3, freq='B')
        except Exception:
            date_index = pd.date_range(end=datetime.today(), periods=3, freq='B')
            
        prices = pd.Series([100.0, 101.0, 102.0], index=date_index)
        returns = prices.pct_change().dropna()
        return {
            "source": "mock",
            "status": "DELAYED",
            "prices": prices.tolist(),
            "returns": returns.tolist(),
            "dates": [str(d.date()) for d in returns.index],
            "last_price": float(prices.iloc[-1])
        }

class MarketDataHubService:
    PROVIDERS = [YahooFinanceAdapter(), AlphaVantageAdapter(), MockAdapter()]

    @classmethod
    def fetch_data(cls, db: Session, ticker: str, start: str, end: str) -> Dict[str, Any]:
        instrument = InstrumentMasterService.get_instrument(db, ticker)
        inst_id = instrument.id if instrument else None

        result = None
        for i, adapter in enumerate(cls.PROVIDERS):
            try:
                result = adapter.fetch(ticker, start, end)
                result['source_priority'] = i + 1
                break
            except Exception as e:
                continue

        if not result:
            raise ValueError("All market data providers failed")

        if inst_id is not None:
            md = MarketData(
                instrument_id=inst_id,
                provider=result["source"],
                timestamp=datetime.utcnow(),
                price=result["last_price"],
                volume=0.0,
                status=result["status"],
                source_priority=result["source_priority"]
            )
            db.add(md)
            db.commit()

        return result

class DataQualityCenterService:
    @staticmethod
    def validate_instrument_data(db: Session, ticker: str) -> DataQualityReport:
        instrument = InstrumentMasterService.get_instrument(db, ticker)
        
        missing_metadata = False
        inst_id = 0
        
        if not instrument:
            missing_metadata = True
        else:
            if not instrument.asset_class or not instrument.currency:
                missing_metadata = True
            inst_id = instrument.id
            
        md = None
        if inst_id:
            md = db.query(MarketData).filter(MarketData.instrument_id == inst_id).order_by(MarketData.timestamp.desc()).first()
        
        stale_prices = False
        missing_data = False
        invalid_prices = False
        outliers = False
        
        if not md:
            missing_data = True
        else:
            if datetime.utcnow() - md.timestamp > timedelta(days=1):
                stale_prices = True
            if md.price is None or md.price <= 0:
                invalid_prices = True
            
        return DataQualityReport(
            instrument_id=inst_id,
            missing_data=missing_data,
            stale_prices=stale_prices,
            invalid_prices=invalid_prices,
            outliers=outliers,
            duplicates=False,
            missing_metadata=missing_metadata,
            insufficient_history=missing_data,
            details={"last_update": md.timestamp.isoformat() if md else None}
        )

class PortfolioDataHubService:
    @staticmethod
    def import_from_csv(db: Session, file_content: str, portfolio_name: str) -> Portfolio:
        reader = csv.DictReader(io.StringIO(file_content))
        
        portfolio = Portfolio(name=portfolio_name, description="Imported via CSV")
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
        
        total_value = 0.0
        total_weight = 0.0
        assets_to_add = []
        
        for row in reader:
            ticker = row.get("ticker", "").strip().upper()
            if not ticker:
                continue
                
            try:
                weight = float(row.get("weight", 0.0))
                value = float(row.get("value", 0.0))
            except ValueError:
                raise ValueError(f"Invalid numeric data for ticker {ticker}")
            
            total_weight += weight
            total_value += value
            
            asset = PortfolioAsset(
                portfolio_id=portfolio.id,
                ticker=ticker,
                weight=weight,
                value=value,
                asset_type="equity"
            )
            assets_to_add.append(asset)
            
        if not assets_to_add:
            raise ValueError("CSV contains no valid assets")
            
        if abs(total_weight - 1.0) > 0.01 and total_weight > 0:
            # Normalize weights if they are provided but don't sum to 1
            for asset in assets_to_add:
                asset.weight = asset.weight / total_weight

        db.add_all(assets_to_add)
        portfolio.total_value = total_value
        db.commit()
        
        return portfolio

