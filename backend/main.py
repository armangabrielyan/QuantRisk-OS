"""QuantRisk OS - Main FastAPI Application Entry Point"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Database initialization + FRM seeding
# ---------------------------------------------------------------------------

def initialize_database():
    """Initialize SQLite database tables."""
    from app.database.session import init_db
    init_db()
    logger.info("Database tables created.")


def seed_frm_questions():
    """Seed FRM questions if database is empty."""
    from app.database.session import SessionLocal
    from app.models.orm_models import FRMQuestion
    from app.services.frm_questions import FRM_QUESTIONS

    db = SessionLocal()
    try:
        count = db.query(FRMQuestion).count()
        if count == 0:
            logger.info(f"Seeding {len(FRM_QUESTIONS)} FRM questions...")
            for qdata in FRM_QUESTIONS:
                q = FRMQuestion(
                    category=qdata["category"],
                    subcategory=qdata.get("subcategory"),
                    difficulty=qdata["difficulty"],
                    prompt=qdata["prompt"],
                    option_a=qdata.get("option_a"),
                    option_b=qdata.get("option_b"),
                    option_c=qdata.get("option_c"),
                    option_d=qdata.get("option_d"),
                    correct_answer=qdata["correct_answer"],
                    explanation=qdata["explanation"],
                    formula=qdata.get("formula"),
                    derivation=qdata.get("derivation"),
                    common_mistake=qdata.get("common_mistake"),
                    tags=qdata.get("tags", []),
                    is_calculation=qdata.get("is_calculation", True),
                )
                db.add(q)
            db.commit()
            logger.info("FRM questions seeded successfully.")
        else:
            logger.info(f"FRM questions already present: {count} questions.")
    except Exception as e:
        logger.error(f"Error seeding FRM questions: {e}")
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("QuantRisk OS starting up...")
    initialize_database()
    seed_frm_questions()
    yield
    logger.info("QuantRisk OS shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="QuantRisk OS",
    description=(
        "Quantitative Risk Management, Econometrics, Banking Workbench & FRM Learning Engine.\n\n"
        "A professional-grade, locally-runnable quantitative finance application."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=422,
        content={"status": "error", "detail": str(exc)},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error [{request.method} {request.url}]: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "detail": "An internal server error occurred.",
        },
    )


# ---------------------------------------------------------------------------
# Health & info endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "application": "QuantRisk OS",
        "version": "1.0.0",
    }


@app.get("/api/info", tags=["System"])
async def info():
    return {
        "status": "success",
        "data": {
            "name": "QuantRisk OS",
            "version": "1.0.0",
            "modules": [
                "Market Risk: VaR (Parametric/Historical/Monte Carlo), ES, EWMA, GARCH, Black-Scholes, Implied Vol, Vol Surface",
                "Credit Risk: Expected Loss, Merton Structural Model, Credit Scoring (Logistic Regression)",
                "ALM/Liquidity: Duration Gap, LCR (Basel III), NSFR (Basel III)",
                "Econometrics: ADF Test, ACF/PACF, OLS Regression, Heteroskedasticity Tests, VIF",
                "Portfolio Analytics: Sharpe, Sortino, Max Drawdown, Efficient Frontier, Covariance",
                "Stress Testing: GFC 2008, COVID 2020, Regional Banking 2023 scenario templates",
                "FRM Trainer: 35 calculation-heavy questions, quiz sessions, score tracking",
                "Reports: Bank Risk Committee Summary (Markdown + JSON)",
                "Market Data: yfinance live data + deterministic offline fallback",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Include routers
# ---------------------------------------------------------------------------

from app.api.market_risk import router as market_risk_router
from app.api.credit_risk import router as credit_risk_router
from app.api.alm import router as alm_router
from app.api.econometrics import router as econometrics_router
from app.api.portfolio import router as portfolio_router
from app.api.stress_testing import router as stress_testing_router
from app.api.data import router as data_router
from app.api.reports import router as reports_router
from app.api.frm_trainer import router as frm_trainer_router
from app.api.op_risk import router as op_risk_router
from app.api.risk_intelligence import router as risk_intelligence_router

app.include_router(market_risk_router)
app.include_router(credit_risk_router)
app.include_router(alm_router)
app.include_router(econometrics_router)
app.include_router(portfolio_router)
app.include_router(stress_testing_router)
app.include_router(data_router)
app.include_router(reports_router)
app.include_router(frm_trainer_router)
app.include_router(op_risk_router)
app.include_router(risk_intelligence_router)
