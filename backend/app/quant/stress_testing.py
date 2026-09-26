"""QuantRisk OS - Stress Testing Engine"""
from typing import Dict, Any

# ---------------------------------------------------------------------------
# Crisis Scenario Presets
# ---------------------------------------------------------------------------
# These are scenario TEMPLATES inspired by historical events.
# Shocks are illustrative and do not claim to reproduce exact historical moves.
# Users should adjust based on their own portfolio characteristics.

CRISIS_SCENARIOS: Dict[str, Dict[str, Any]] = {
    "2008_gfc": {
        "name": "2008 Global Financial Crisis",
        "description": (
            "Inspired by the 2007-2009 Global Financial Crisis. "
            "Lehman Brothers collapse, credit markets seizing, severe equity drawdowns, "
            "and liquidity crunch. Shocks are scenario templates, not exact reproductions."
        ),
        "equity_shock": -0.45,
        "vol_shock": 3.0,           # VIX-equivalent multiplier
        "rate_shock": -0.02,         # 200bps rate cut (flight to safety)
        "credit_spread_shock": 0.05, # 500bps spread widening
        "liquidity_shock": 0.30,     # 30% HQLA haircut / LCR stress
        "deposit_outflow": 0.08,     # 8% deposit outflow rate
    },
    "2020_covid": {
        "name": "2020 COVID-19 Market Shock",
        "description": (
            "Inspired by the March 2020 COVID-19 market dislocation. "
            "Rapid equity sell-off, extreme volatility, central bank emergency cuts. "
            "Subsequent recovery not modeled here — this is the initial shock template."
        ),
        "equity_shock": -0.34,
        "vol_shock": 4.5,
        "rate_shock": -0.015,
        "credit_spread_shock": 0.025,
        "liquidity_shock": 0.25,
        "deposit_outflow": 0.03,
    },
    "2023_banking": {
        "name": "2023 U.S. Regional Banking Stress",
        "description": (
            "Inspired by the SVB/Signature/First Republic deposit-run events of 2023. "
            "Duration risk from rate hikes, deposit outflows, regional bank equity stress. "
            "Scenario template — not a full replication of the regulatory resolution actions."
        ),
        "equity_shock": -0.25,
        "vol_shock": 2.0,
        "rate_shock": 0.015,         # Rates rose during this episode
        "credit_spread_shock": 0.03,
        "liquidity_shock": 0.40,
        "deposit_outflow": 0.15,
    },
}


# ---------------------------------------------------------------------------
# Apply Stress Scenario
# ---------------------------------------------------------------------------

def apply_stress_scenario(
    portfolio_value: float,
    var_base: float,
    es_base: float,
    vol_base: float,
    duration_gap_base: float,
    lcr_base: float,
    equity_shock: float,
    vol_shock: float,
    rate_shock: float,
    credit_spread_shock: float,
    liquidity_shock: float,
    deposit_outflow: float,
    scenario_name: str = "Custom",
) -> dict:
    """
    Apply a stress scenario to a portfolio and compute before/after metrics.

    Methodology:
    - Equity P&L: portfolio_value * equity_shock
    - VaR stress: VaR scales with volatility multiplier
    - Vol stress: vol_base * vol_shock (additive: vol_shock as factor, e.g. 3.0 = triple)
    - Duration impact: -duration_gap * portfolio_value * rate_shock (linear approx)
    - LCR stress: LCR * (1 - liquidity_shock) — simplified proxy
    - Credit spread impact: treated as additional spread loss
    """
    if portfolio_value <= 0:
        raise ValueError("Portfolio value must be positive")

    # ── P&L Impact ──────────────────────────────────────────────────────────
    # Equity loss/gain from equity shock
    equity_pnl = portfolio_value * equity_shock
    pnl_loss = -equity_pnl  # positive = loss

    # Duration impact (interest rate shock on portfolio value)
    # Using simplified: ΔV ≈ -D_gap * V * Δr
    duration_pnl = -duration_gap_base * portfolio_value * rate_shock
    total_pnl = equity_pnl + duration_pnl
    total_loss = -total_pnl
    pct_loss = float(total_loss / portfolio_value * 100) if portfolio_value > 0 else 0.0

    # ── Risk Metrics Under Stress ────────────────────────────────────────────
    # Volatility scales by vol_shock factor
    vol_stressed = vol_base * vol_shock
    vol_change = vol_stressed - vol_base

    # VaR scales approximately with volatility ratio
    var_stressed = var_base * vol_shock
    var_change = var_stressed - var_base

    # ES stressed (approximately proportional to VaR change)
    es_stressed = es_base * vol_shock
    es_change = es_stressed - es_base

    # LCR: stressed by liquidity_shock (fraction reduction)
    lcr_stressed = lcr_base * (1.0 - liquidity_shock)
    lcr_change = lcr_stressed - lcr_base

    # Stressed portfolio value
    portfolio_stressed = portfolio_value + total_pnl

    # Credit spread impact on bond/loan portfolio (simplified)
    # Assuming 50% of portfolio is credit-sensitive with duration ~3
    credit_impact = -0.50 * portfolio_value * 3.0 * credit_spread_shock

    # Deposit outflow liquidity impact
    deposit_loss = portfolio_value * deposit_outflow

    return {
        "scenario_name": scenario_name,
        "base": {
            "portfolio_value": portfolio_value,
            "var": var_base,
            "es": es_base,
            "volatility": vol_base,
            "duration_gap": duration_gap_base,
            "lcr": lcr_base,
        },
        "stress": {
            "portfolio_value": float(portfolio_stressed),
            "var": float(var_stressed),
            "es": float(es_stressed),
            "volatility": float(vol_stressed),
            "duration_gap": duration_gap_base,  # structural — doesn't change in scenario
            "lcr": float(max(0.0, lcr_stressed)),
        },
        "impact": {
            "equity_pnl": float(equity_pnl),
            "duration_pnl": float(duration_pnl),
            "rate_impact": float(duration_pnl),           # alias for duration_pnl
            "credit_spread_impact": float(credit_impact),
            "liquidity_impact": float(-deposit_loss),     # negative = outflow cost
            "deposit_impact": float(-deposit_loss),
            "total_pnl": float(total_pnl),
            "total_loss": float(total_loss),
            "pct_loss": float(pct_loss),
            "var_change": float(var_change),
            "var_change_pct": float(var_change / var_base * 100) if var_base > 0 else 0.0,
            "es_change": float(es_change),
            "vol_change": float(vol_change),
            "vol_change_pct": float(vol_change / vol_base * 100) if vol_base > 0 else 0.0,
            "lcr_change": float(lcr_change),
            "deposit_outflow_amount": float(deposit_loss),
        },
        "shocks_applied": {
            "equity_shock": equity_shock,
            "vol_shock_multiplier": vol_shock,
            "rate_shock": rate_shock,
            "credit_spread_shock": credit_spread_shock,
            "liquidity_shock": liquidity_shock,
            "deposit_outflow": deposit_outflow,
        },
    }


def get_scenario_presets() -> dict:
    """Return all predefined crisis scenario presets."""
    return CRISIS_SCENARIOS
