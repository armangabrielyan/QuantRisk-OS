"""QuantRisk OS - SQLAlchemy ORM Models"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    total_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assets = relationship("PortfolioAsset", back_populates="portfolio", cascade="all, delete-orphan")
    risk_calculations = relationship("RiskCalculation", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioAsset(Base):
    __tablename__ = "portfolio_assets"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String(20), nullable=False)
    name = Column(String(200), nullable=True)
    weight = Column(Float, nullable=False, default=0.0)
    value = Column(Float, nullable=False, default=0.0)
    asset_type = Column(String(50), default="equity")  # equity, bond, commodity, etc.

    portfolio = relationship("Portfolio", back_populates="assets")


class RiskCalculation(Base):
    __tablename__ = "risk_calculations"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=True)
    calculation_type = Column(String(100), nullable=False)  # var, es, garch, etc.
    parameters = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="risk_calculations")


class FRMQuestion(Base):
    __tablename__ = "frm_questions"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False)
    subcategory = Column(String(100), nullable=True)
    difficulty = Column(String(20), nullable=False)  # easy, medium, hard
    prompt = Column(Text, nullable=False)
    option_a = Column(Text, nullable=True)
    option_b = Column(Text, nullable=True)
    option_c = Column(Text, nullable=True)
    option_d = Column(Text, nullable=True)
    correct_answer = Column(String(1), nullable=False)  # A, B, C, D
    explanation = Column(Text, nullable=False)
    formula = Column(Text, nullable=True)
    derivation = Column(Text, nullable=True)
    common_mistake = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    is_calculation = Column(Boolean, default=True)

    attempts = relationship("QuizAttempt", back_populates="question")


class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String(200), nullable=True)
    category_filter = Column(String(100), nullable=True)
    difficulty_filter = Column(String(20), nullable=True)
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    score_pct = Column(Float, default=0.0)
    completed = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    attempts = relationship("QuizAttempt", back_populates="session", cascade="all, delete-orphan")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("quiz_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("frm_questions.id"), nullable=False)
    selected_answer = Column(String(1), nullable=True)
    is_correct = Column(Boolean, nullable=True)
    time_taken_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("QuizSession", back_populates="attempts")
    question = relationship("FRMQuestion", back_populates="attempts")


class StressScenario(Base):
    __tablename__ = "stress_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    scenario_type = Column(String(50), default="custom")  # preset, custom
    parameters = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SavedAnalysis(Base):
    __tablename__ = "saved_analyses"

    id = Column(Integer, primary_key=True, index=True)
    analysis_type = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    parameters = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    internal_id = Column(String(50), unique=True, index=True, nullable=False)
    ticker = Column(String(20), index=True, nullable=False)
    isin = Column(String(12), unique=True, index=True, nullable=True)
    figi_cusip = Column(String(20), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    asset_class = Column(String(50), nullable=False)
    sector = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)
    issuer = Column(String(100), nullable=True)
    rating = Column(String(10), nullable=True)
    maturity = Column(DateTime, nullable=True)
    provider_symbols = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    market_data = relationship("MarketData", back_populates="instrument")


class MarketData(Base):
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    provider = Column(String(50), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    price = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)
    status = Column(String(20), default="LIVE")  # LIVE, DELAYED, STALE, MISSING
    source_priority = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="market_data")

class RiskLimit(Base):
    __tablename__ = "risk_limits"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(String(50), nullable=False)
    limit_type = Column(String(50), nullable=False)
    warning_limit = Column(Float, nullable=False)
    hard_limit = Column(Float, nullable=False)
    current_value = Column(Float, nullable=True, default=0.0)
    utilization_pct = Column(Float, nullable=True, default=0.0)
    status = Column(String(20), default="GREEN")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RiskAlert(Base):
    __tablename__ = "risk_alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_level = Column(String(20), nullable=False) # INFO, WARNING, HIGH, CRITICAL
    message = Column(String(500), nullable=False)
    source = Column(String(100), nullable=True)
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

class RiskAppetite(Base):
    __tablename__ = "risk_appetite"

    id = Column(Integer, primary_key=True, index=True)
    statement = Column(Text, nullable=False)
    metrics = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
