# QuantRisk OS

### Quantitative Risk Management, Econometrics, Banking Workbench & FRM Learning Engine

A professional-grade, locally-runnable full-stack quantitative finance application built with FastAPI and React.

---

## Overview

QuantRisk OS serves two purposes:

**Academic / Learning**
- FRM Part I & II exam preparation with calculation-heavy question bank
- Econometrics (ADF, OLS, ACF/PACF, heteroskedasticity tests)
- Financial statistics and quantitative methods

**Professional Risk Management**
- Market Risk: VaR (Parametric, Historical, Monte Carlo), Expected Shortfall, EWMA/GARCH volatility
- Options: Black-Scholes pricing, Greeks, Implied Volatility, 3D Volatility Surface
- Credit Risk: Expected Loss (PD×LGD×EAD), Merton Distance-to-Default, Logistic Credit Scoring
- ALM/IRRBB: Duration Gap, Equity Sensitivity to Rate Shocks
- Liquidity: LCR (Basel III), NSFR (Basel III)
- Portfolio: Markowitz Efficient Frontier, Sharpe/Sortino, Drawdown, Correlation Heatmaps
- Stress Testing: Historical Crisis Scenarios (GFC 2008, COVID 2020, Banking 2023), Custom Shocks
- Risk Reporting: Bank Risk Committee Report Generator (Markdown + JSON)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.9+, FastAPI, Uvicorn |
| Math | NumPy, SciPy, Pandas, statsmodels, scikit-learn, arch |
| Database | SQLite + SQLAlchemy |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Charts | Plotly.js (react-plotly.js), Recharts |
| Icons | Lucide React |

---

## Quick Start

### 1. Backend

```bash
cd backend

# Install dependencies (Python 3.9+)
pip3 install -r requirements.txt

# Start backend
python3 -m uvicorn main:app --reload --port 8000
```

Backend available at: http://localhost:8000  
API docs (Swagger UI): http://localhost:8000/docs  
Health check: http://localhost:8000/api/health

### 2. Frontend

```bash
cd frontend

# Install dependencies (Node 18+)
npm install

# Start dev server
npm run dev
```

Frontend available at: http://localhost:5173

---

## API Endpoints

### Market Risk — `/api/market-risk/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/var/parametric` | Parametric VaR & ES (Normal/Student-t) |
| POST | `/var/historical` | Historical Simulation VaR & ES |
| POST | `/var/monte-carlo` | Monte Carlo VaR (GBM, N simulations) |
| POST | `/volatility` | EWMA / GARCH(1,1) / Historical Volatility |
| POST | `/black-scholes` | BSM Option Pricing + Greeks |
| POST | `/implied-volatility` | Implied Volatility (Brent's method) |
| POST | `/volatility-surface` | Implied Volatility Surface data |

### Credit Risk — `/api/credit-risk/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/expected-loss` | EL = PD × LGD × EAD portfolio |
| POST | `/merton-model` | Merton Distance-to-Default, PD |
| POST | `/credit-scoring` | Logistic regression credit scoring pipeline |

### ALM — `/api/alm/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/duration-gap` | Duration Gap, IRRBB equity sensitivity |
| POST | `/lcr` | Liquidity Coverage Ratio (Basel III) |
| POST | `/nsfr` | Net Stable Funding Ratio (Basel III) |

### Econometrics — `/api/econometrics/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/time-series-diagnostics` | ADF test + descriptive stats |
| POST | `/acf-pacf` | ACF & PACF with confidence intervals |
| POST | `/descriptive-stats` | Full distribution stats (skew, kurtosis, JB) |
| POST | `/ols-regression` | OLS with full inference table |
| POST | `/diagnostics` | Breusch-Pagan, Durbin-Watson, Breusch-Godfrey |
| POST | `/vif` | Variance Inflation Factors (multicollinearity) |

### Portfolio — `/api/portfolio/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analytics` | Full portfolio analytics (Sharpe, Sortino, MDD) |
| POST | `/efficient-frontier` | Markowitz efficient frontier (Monte Carlo) |
| POST | `/drawdown` | Maximum drawdown analysis |

### Stress Testing — `/api/stress-testing/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scenarios` | List all preset crisis scenarios |
| POST | `/apply` | Apply custom shock scenario |
| POST | `/apply-preset` | Apply a named historical scenario |

### FRM Trainer — `/api/frm-trainer/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/questions` | List questions with filters |
| GET | `/questions/{id}` | Get single question |
| GET | `/questions/{id}/answer` | Get answer + explanation |
| POST | `/quiz/start` | Start timed quiz session |
| POST | `/quiz/answer` | Submit answer, get instant feedback |
| POST | `/quiz/complete` | Complete quiz, get score |
| GET | `/history` | Session history |
| GET | `/categories` | Category breakdown |

### Data — `/api/data/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fetch?ticker=SPY` | Fetch market data (live via yfinance, or offline) |
| GET | `/sample/{ticker}` | Get deterministic sample data |
| GET | `/sample-tickers` | List available offline tickers |

### Reports — `/api/reports/`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/risk-committee` | Generate Bank Risk Committee Report (MD + JSON) |

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Overview | `/` | Risk dashboard — all key metrics at a glance |
| Market Risk | `/market-risk` | VaR, Volatility, BSM, Vol Surface |
| Credit & ALM | `/credit-alm` | EL, Merton, Duration Gap, LCR, NSFR |
| Econometrics | `/econometrics` | ADF, ACF/PACF, OLS, Diagnostics |
| Portfolio | `/portfolio` | Efficient Frontier, Heatmap, Drawdown |
| FRM Trainer | `/frm-trainer` | Interactive quiz with explanations |
| Crisis Sandbox | `/stress` | Stress test with historical presets + sliders |
| Reports | `/reports` | Risk committee report generator |

---

## Running Tests

```bash
cd backend
python3 -m pytest tests/test_quant.py -v
# 67 tests, all pass
```

---

## Architecture

```
risk-matrix-os/
├── backend/
│   ├── main.py                    # FastAPI app, lifespan, routers
│   ├── requirements.txt
│   └── app/
│       ├── api/                   # FastAPI routers
│       │   ├── market_risk.py
│       │   ├── credit_risk.py
│       │   ├── alm.py
│       │   ├── econometrics.py
│       │   ├── portfolio.py
│       │   ├── stress_testing.py
│       │   ├── data.py
│       │   ├── reports.py
│       │   └── frm_trainer.py
│       ├── quant/                 # Mathematical engines
│       │   ├── market_risk.py     # VaR, BSM, GARCH, IV
│       │   ├── credit_risk.py     # EL, Merton, scoring
│       │   ├── alm.py             # Duration gap, LCR, NSFR
│       │   ├── econometrics.py    # ADF, OLS, diagnostics
│       │   ├── portfolio.py       # Frontier, analytics
│       │   └── stress_testing.py  # Crisis scenarios
│       ├── models/                # SQLAlchemy ORM models
│       ├── database/              # DB session, init
│       ├── services/              # FRM question bank (35 Qs)
│       └── tests/
│           └── test_quant.py      # 67 unit tests
└── frontend/
    ├── src/
    │   ├── App.tsx                # Router
    │   ├── components/
    │   │   ├── Sidebar.tsx
    │   │   └── ui.tsx             # Shared components
    │   ├── pages/                 # All 8 page components
    │   ├── services/api.ts        # Axios client
    │   └── types/index.ts         # TypeScript interfaces
    └── ...config files
```

---

## Notes

- **Data**: Offline sample data (10 tickers, deterministic/reproducible) used when network is unavailable. Live data via yfinance when connected.
- **FRM Questions**: 35 questions across 7 categories (Quantitative Analysis, Market Risk, Credit Risk, ALM, Valuation, Operational Risk, Financial Markets). All calculation-focused with full worked solutions.
- **Basel III**: LCR and NSFR calculations follow Basel III Basel Committee on Banking Supervision guidelines (100% minimum).
- **IRRBB**: Duration gap analysis follows the simplified IRRBB framework.
