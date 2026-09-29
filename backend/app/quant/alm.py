"""QuantRisk OS - ALM, Liquidity & IRRBB Engine"""
from typing import List, Dict
import numpy as np


# ---------------------------------------------------------------------------
# 1. Duration Gap Analysis
# ---------------------------------------------------------------------------

def duration_gap(
    asset_duration: float,
    liability_duration: float,
    asset_value: float,
    liability_value: float,
    rate_shock: float = 0.01,
) -> dict:
    """
    Duration Gap Analysis (IRRBB).

    Duration Gap = D_A - (L/A) * D_L

    Equity sensitivity to rate shock:
    ΔE ≈ -DurationGap × A × Δr

    (Uses simple linear approximation, ignores convexity for primary result,
    but provides convexity-adjusted estimate if duration is provided.)

    Regulatory context: Basel IRRBB requires banks to manage NII and EVE
    sensitivity. Duration gap is a simplified EVE approach.
    """
    if asset_value <= 0:
        raise ValueError("Asset value must be positive")
    if liability_value <= 0:
        raise ValueError("Liability value must be positive")
    if asset_duration < 0:
        raise ValueError("Asset duration must be non-negative")
    if liability_duration < 0:
        raise ValueError("Liability duration must be non-negative")

    leverage = liability_value / asset_value
    gap = asset_duration - leverage * liability_duration
    equity_value = asset_value - liability_value

    # Linear approximation: ΔE ≈ -Gap × A × Δr
    equity_sensitivity = -gap * asset_value * rate_shock

    # Equity percentage change
    equity_sensitivity_pct = (
        float(equity_sensitivity / equity_value * 100)
        if equity_value > 0
        else float("nan")
    )

    # Decompose: ΔA ≈ -D_A × A × Δr, ΔL ≈ -D_L × L × Δr
    delta_assets = -asset_duration * asset_value * rate_shock
    delta_liabilities = -liability_duration * liability_value * rate_shock
    delta_equity = delta_assets - delta_liabilities

    return {
        "duration_gap": float(gap),
        "equity_sensitivity": float(equity_sensitivity),
        "equity_sensitivity_pct": equity_sensitivity_pct,
        "asset_duration": float(asset_duration),
        "liability_duration": float(liability_duration),
        "asset_value": float(asset_value),
        "liability_value": float(liability_value),
        "equity_value": float(equity_value),
        "leverage_ratio": float(leverage),
        "rate_shock": float(rate_shock),
        "rate_shock_bps": float(rate_shock * 10_000),
        "delta_assets": float(delta_assets),
        "delta_liabilities": float(delta_liabilities),
        "delta_equity": float(delta_equity),
        "interpretation": (
            "Positive gap: equity value declines when rates rise. "
            "Negative gap: equity value increases when rates rise."
            if gap >= 0
            else "Negative gap: equity value increases when rates rise."
        ),
    }


# ---------------------------------------------------------------------------
# 2. LCR Calculator
# ---------------------------------------------------------------------------

def lcr_calculator(
    hqla: float,
    cash_outflows: float,
    cash_inflows: float,
    stress_horizon: int = 30,
) -> dict:
    """
    Liquidity Coverage Ratio (LCR).

    LCR = HQLA / Net Cash Outflows

    Net Cash Outflows = Gross Outflows - min(Inflows, 75% of Gross Outflows)
    Per Basel III: Inflows are capped at 75% of gross outflows.

    Minimum regulatory requirement: 100% (fully phased-in).
    """
    if hqla < 0:
        raise ValueError("HQLA cannot be negative")
    if cash_outflows < 0:
        raise ValueError("Cash outflows cannot be negative")
    if cash_inflows < 0:
        raise ValueError("Cash inflows cannot be negative")
    if stress_horizon < 1:
        raise ValueError("Stress horizon must be >= 1 day")

    # Basel III inflow cap: min(inflows, 75% of outflows)
    capped_inflows = min(cash_inflows, 0.75 * cash_outflows)
    net_cash_outflows = max(cash_outflows - capped_inflows, 0.0)

    if net_cash_outflows == 0:
        lcr = float("inf")
        lcr_display = 9999.0  # effectively unlimited
    else:
        lcr = hqla / net_cash_outflows
        lcr_display = float(lcr)

    lcr_pct = min(lcr_display * 100, 99_999.0)

    if lcr >= 1.0:
        interpretation = f"LCR of {lcr_pct:.1f}% meets the minimum 100% Basel III requirement."
        status = "PASS"
    else:
        shortfall = net_cash_outflows - hqla
        interpretation = (
            f"LCR of {lcr_pct:.1f}% FAILS the 100% minimum. "
            f"HQLA shortfall: {shortfall:,.0f}."
        )
        status = "FAIL"

    return {
        "lcr": float(lcr_display),
        "lcr_pct": float(lcr_pct),
        "hqla": float(hqla),
        "gross_outflows": float(cash_outflows),
        "gross_inflows": float(cash_inflows),
        "capped_inflows": float(capped_inflows),
        "net_cash_outflows": float(net_cash_outflows),
        "stress_horizon_days": stress_horizon,
        "minimum_requirement_pct": 100.0,
        "status": status,
        "interpretation": interpretation,
        "surplus_deficit": float(hqla - net_cash_outflows),
    }


# ---------------------------------------------------------------------------
# 3. NSFR Calculator
# ---------------------------------------------------------------------------

def nsfr_calculator(
    asf_components: List[dict],
    rsf_components: List[dict],
) -> dict:
    """
    Net Stable Funding Ratio (NSFR).

    NSFR = Available Stable Funding (ASF) / Required Stable Funding (RSF)

    ASF: weighted sum of liabilities and equity by ASF factor
    RSF: weighted sum of assets by RSF factor
    Minimum requirement: 100% (Basel III)

    Components format: {name: str, amount: float, factor: float}
    Factor: regulatory ASF/RSF factor in [0, 1]
    """
    if not asf_components:
        raise ValueError("At least one ASF component required")
    if not rsf_components:
        raise ValueError("At least one RSF component required")

    asf_items = []
    total_asf = 0.0
    for item in asf_components:
        amount = float(item["amount"])
        factor = float(item["factor"])
        if not 0 <= factor <= 1:
            raise ValueError(f"ASF factor must be in [0, 1], got {factor}")
        weighted = amount * factor
        asf_items.append({
            "name": item["name"],
            "amount": amount,
            "factor": factor,
            "weighted_amount": float(weighted),
        })
        total_asf += weighted

    rsf_items = []
    total_rsf = 0.0
    for item in rsf_components:
        amount = float(item["amount"])
        factor = float(item["factor"])
        if not 0 <= factor <= 1:
            raise ValueError(f"RSF factor must be in [0, 1], got {factor}")
        weighted = amount * factor
        rsf_items.append({
            "name": item["name"],
            "amount": amount,
            "factor": factor,
            "weighted_amount": float(weighted),
        })
        total_rsf += weighted

    if total_rsf <= 0:
        raise ValueError("Total RSF cannot be zero or negative")

    nsfr = total_asf / total_rsf
    nsfr_pct = float(nsfr * 100)

    if nsfr >= 1.0:
        status = "PASS"
        interpretation = (
            f"NSFR of {nsfr_pct:.1f}% meets the 100% minimum Basel III requirement. "
            f"Stable funding surplus: {total_asf - total_rsf:,.0f}."
        )
    else:
        status = "FAIL"
        interpretation = (
            f"NSFR of {nsfr_pct:.1f}% fails the 100% minimum. "
            f"Stable funding shortfall: {total_rsf - total_asf:,.0f}."
        )

    return {
        "nsfr": float(nsfr),
        "nsfr_pct": nsfr_pct,
        "asf": float(total_asf),
        "rsf": float(total_rsf),
        "surplus_deficit": float(total_asf - total_rsf),
        "components_asf": asf_items,
        "components_rsf": rsf_items,
        "status": status,
        "interpretation": interpretation,
        "minimum_requirement_pct": 100.0,
    }


def nelson_siegel_svensson(maturities: list[float], b0: float, b1: float, b2: float, b3: float, tau1: float, tau2: float) -> dict:
    """NSS Yield Curve."""
    import numpy as np
    m = np.array(maturities)
    
    # Avoid division by zero
    m = np.where(m == 0, 1e-6, m)
    
    term1 = (1 - np.exp(-m/tau1)) / (m/tau1)
    term2 = term1 - np.exp(-m/tau1)
    term3 = ((1 - np.exp(-m/tau2)) / (m/tau2)) - np.exp(-m/tau2)
    
    yields = b0 + b1*term1 + b2*term2 + b3*term3
    
    return {
        "maturities": m.tolist(),
        "yields": yields.tolist()
    }

def bond_dv01_convexity(cashflows: list[float], times: list[float], yield_rate: float, current_price: float) -> dict:
    """DV01 (BPV) and Convexity for a bond."""
    import numpy as np
    cf = np.array(cashflows)
    t = np.array(times)
    y = yield_rate
    
    # Mac Macaulay Duration
    discount_factors = np.exp(-y * t) # Continuous compounding for simplicity
    pv_cf = cf * discount_factors
    price = np.sum(pv_cf) if current_price is None else current_price
    
    mac_dur = np.sum(t * pv_cf) / price
    mod_dur = mac_dur # For continuous, ModDur = MacDur
    
    dv01 = mod_dur * price * 0.0001
    
    convexity = np.sum(t**2 * pv_cf) / price
    
    return {
        "price": float(price),
        "dv01": float(dv01),
        "macaulay_duration": float(mac_dur),
        "modified_duration": float(mod_dur),
        "convexity": float(convexity)
    }
