"""QuantRisk OS - Portfolio Analytics Engine"""
from typing import List, Optional
import numpy as np
import pandas as pd
from scipy.optimize import minimize


# ---------------------------------------------------------------------------
# 1. Portfolio Analytics
# ---------------------------------------------------------------------------

def portfolio_analytics(
    returns_matrix: List[List[float]],
    weights: List[float],
    asset_names: List[str],
    risk_free_rate: float = 0.02,
) -> dict:
    """
    Compute portfolio-level and asset-level risk/return metrics.

    returns_matrix: shape (n_assets, n_periods) — each row is one asset's return series
    weights: portfolio weights summing to ~1
    risk_free_rate: annual risk-free rate
    """
    R = np.array(returns_matrix, dtype=float)  # (n_assets, n_periods)
    w = np.array(weights, dtype=float)

    if R.ndim == 1:
        R = R.reshape(1, -1)

    n_assets, n_periods = R.shape

    if len(w) != n_assets:
        raise ValueError(f"weights length {len(w)} != n_assets {n_assets}")
    if n_periods < 10:
        raise ValueError("Need at least 10 return periods")

    # Normalize weights
    w = w / w.sum()

    # Portfolio returns (daily)
    port_returns = R.T @ w  # (n_periods,)

    # Annualized metrics (assuming daily returns)
    mu_daily = float(np.mean(port_returns))
    sigma_daily = float(np.std(port_returns, ddof=1))
    mu_annual = mu_daily * 252
    sigma_annual = sigma_daily * np.sqrt(252)

    rf_daily = risk_free_rate / 252

    # Sharpe Ratio (annualized)
    sharpe = float((mu_annual - risk_free_rate) / sigma_annual) if sigma_annual > 0 else 0.0

    # Sortino Ratio
    downside_returns = port_returns[port_returns < rf_daily]
    downside_vol = float(np.std(downside_returns, ddof=1) * np.sqrt(252)) if len(downside_returns) > 1 else sigma_annual
    sortino = float((mu_annual - risk_free_rate) / downside_vol) if downside_vol > 0 else 0.0

    # Maximum Drawdown
    drawdown_info = maximum_drawdown(port_returns.tolist())

    # Covariance and Correlation matrices
    cov_matrix = np.cov(R, ddof=1)  # (n_assets, n_assets)
    # Portfolio variance
    port_var = float(w @ cov_matrix @ w)

    # Correlation matrix
    std_vec = np.sqrt(np.diag(cov_matrix))
    std_vec[std_vec == 0] = 1e-10
    corr_matrix = cov_matrix / np.outer(std_vec, std_vec)

    # Asset-level metrics
    asset_returns_annual = [float(np.mean(R[i]) * 252) for i in range(n_assets)]
    asset_vols_annual = [float(np.std(R[i], ddof=1) * np.sqrt(252)) for i in range(n_assets)]
    asset_sharpes = [
        float((asset_returns_annual[i] - risk_free_rate) / asset_vols_annual[i])
        if asset_vols_annual[i] > 0 else 0.0
        for i in range(n_assets)
    ]

    # Marginal contribution to risk
    port_sigma = np.sqrt(port_var)
    mcr = (cov_matrix @ w) / port_sigma if port_sigma > 0 else np.zeros(n_assets)
    component_risk = w * mcr  # contribution to portfolio vol
    pct_contribution = component_risk / port_sigma if port_sigma > 0 else np.zeros(n_assets)

    return {
        "portfolio_return": float(mu_annual),
        "portfolio_return_daily": float(mu_daily),
        "portfolio_volatility": float(sigma_annual),
        "portfolio_volatility_daily": float(sigma_daily),
        "portfolio_variance": float(port_var * 252),
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "max_drawdown": drawdown_info["max_drawdown"],
        "max_drawdown_pct": float(drawdown_info["max_drawdown"] * 100),
        "drawdown_series": drawdown_info["drawdown_series"],
        "covariance_matrix": (cov_matrix * 252).tolist(),
        "correlation_matrix": corr_matrix.tolist(),
        "weights": w.tolist(),
        "asset_names": list(asset_names),
        "asset_returns": asset_returns_annual,
        "asset_volatilities": asset_vols_annual,
        "asset_sharpes": asset_sharpes,
        "marginal_contribution_to_risk": mcr.tolist(),
        "component_risk_contribution": component_risk.tolist(),
        "pct_risk_contribution": pct_contribution.tolist(),
        "risk_free_rate": risk_free_rate,
        "n_periods": n_periods,
        "n_assets": n_assets,
    }


# ---------------------------------------------------------------------------
# 2. Efficient Frontier
# ---------------------------------------------------------------------------

def efficient_frontier(
    returns_matrix: List[List[float]],
    asset_names: List[str],
    n_portfolios: int = 500,
    risk_free_rate: float = 0.02,
) -> dict:
    """
    Monte Carlo Efficient Frontier with:
    - Random portfolio simulation
    - Min-variance portfolio (numerical optimization)
    - Max-Sharpe portfolio (numerical optimization)

    Returns long-only portfolios (weights >= 0, sum = 1).
    """
    R = np.array(returns_matrix, dtype=float)
    if R.ndim == 1:
        R = R.reshape(1, -1)

    n_assets, n_periods = R.shape
    if n_periods < 10:
        raise ValueError("Need at least 10 return periods")

    # Annualized mean returns and covariance
    mu = np.mean(R, axis=1) * 252
    cov = np.cov(R, ddof=1) * 252

    if n_assets == 1:
        # Single asset
        w = np.array([1.0])
        port_ret = float(mu[0])
        port_vol = float(np.sqrt(cov[0, 0]))
        sharpe = float((port_ret - risk_free_rate) / port_vol) if port_vol > 0 else 0.0
        return {
            "frontier_returns": [port_ret],
            "frontier_vols": [port_vol],
            "frontier_sharpes": [sharpe],
            "frontier_weights": [w.tolist()],
            "min_vol_portfolio": {"return": port_ret, "volatility": port_vol, "sharpe": sharpe, "weights": w.tolist()},
            "max_sharpe_portfolio": {"return": port_ret, "volatility": port_vol, "sharpe": sharpe, "weights": w.tolist()},
            "asset_returns": [float(m) for m in mu],
            "asset_vols": [float(np.sqrt(cov[i, i])) for i in range(n_assets)],
            "asset_names": list(asset_names),
        }

    # Monte Carlo simulation
    rng = np.random.default_rng(42)
    frontier_rets = []
    frontier_vols = []
    frontier_sharpes = []
    frontier_weights = []

    for _ in range(n_portfolios):
        raw_w = rng.dirichlet(np.ones(n_assets))  # long-only by construction
        ret = float(raw_w @ mu)
        vol = float(np.sqrt(raw_w @ cov @ raw_w))
        sharpe = (ret - risk_free_rate) / vol if vol > 0 else 0.0
        frontier_rets.append(ret)
        frontier_vols.append(vol)
        frontier_sharpes.append(float(sharpe))
        frontier_weights.append(raw_w.tolist())

    # Optimization: Min-Variance Portfolio
    def portfolio_vol(w):
        return float(np.sqrt(w @ cov @ w))

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    bounds = [(0.0, 1.0)] * n_assets
    w0 = np.ones(n_assets) / n_assets

    res_minvol = minimize(
        portfolio_vol, w0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-9, "maxiter": 1000},
    )
    if res_minvol.success:
        minvol_w = res_minvol.x
        minvol_w = np.maximum(minvol_w, 0)
        minvol_w /= minvol_w.sum()
    else:
        minvol_w = w0

    minvol_ret = float(minvol_w @ mu)
    minvol_vol = float(np.sqrt(minvol_w @ cov @ minvol_w))
    minvol_sharpe = (minvol_ret - risk_free_rate) / minvol_vol if minvol_vol > 0 else 0.0

    # Optimization: Max-Sharpe (Tangency) Portfolio
    def neg_sharpe(w):
        ret = float(w @ mu)
        vol = float(np.sqrt(w @ cov @ w))
        return -(ret - risk_free_rate) / vol if vol > 0 else 0.0

    res_maxsharpe = minimize(
        neg_sharpe, w0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-9, "maxiter": 1000},
    )
    if res_maxsharpe.success:
        maxsharpe_w = res_maxsharpe.x
        maxsharpe_w = np.maximum(maxsharpe_w, 0)
        maxsharpe_w /= maxsharpe_w.sum()
    else:
        maxsharpe_w = w0

    maxsharpe_ret = float(maxsharpe_w @ mu)
    maxsharpe_vol = float(np.sqrt(maxsharpe_w @ cov @ maxsharpe_w))
    maxsharpe_sharpe = (maxsharpe_ret - risk_free_rate) / maxsharpe_vol if maxsharpe_vol > 0 else 0.0

    return {
        "frontier_returns": frontier_rets,
        "frontier_vols": frontier_vols,
        "frontier_sharpes": frontier_sharpes,
        "frontier_weights": frontier_weights,
        "min_vol_portfolio": {
            "return": minvol_ret,
            "volatility": minvol_vol,
            "sharpe": float(minvol_sharpe),
            "weights": {n: float(w) for n, w in zip(asset_names, minvol_w)},
        },
        "max_sharpe_portfolio": {
            "return": maxsharpe_ret,
            "volatility": maxsharpe_vol,
            "sharpe": float(maxsharpe_sharpe),
            "weights": {n: float(w) for n, w in zip(asset_names, maxsharpe_w)},
        },
        "asset_returns": [float(m) for m in mu],
        "asset_vols": [float(np.sqrt(cov[i, i])) for i in range(n_assets)],
        "asset_names": list(asset_names),
        "risk_free_rate": risk_free_rate,
    }


# ---------------------------------------------------------------------------
# 3. Maximum Drawdown
# ---------------------------------------------------------------------------

def maximum_drawdown(returns: List[float]) -> dict:
    """
    Compute maximum drawdown from a return series.

    Drawdown at time t = (cumulative wealth at t - peak wealth up to t) / peak wealth
    """
    arr = np.array(returns, dtype=float)
    if len(arr) < 2:
        raise ValueError("Need at least 2 observations")

    # Cumulative wealth
    cumulative = np.cumprod(1 + arr)
    running_max = np.maximum.accumulate(cumulative)
    drawdowns = (cumulative - running_max) / running_max

    max_dd = float(np.min(drawdowns))
    trough_idx = int(np.argmin(drawdowns))
    # Peak is the last running max before trough
    peak_idx = int(np.argmax(cumulative[:trough_idx + 1])) if trough_idx > 0 else 0

    return {
        "max_drawdown": max_dd,
        "max_drawdown_pct": float(max_dd * 100),
        "drawdown_series": drawdowns.tolist(),
        "cumulative_returns": cumulative.tolist(),
        "peak_idx": peak_idx,
        "trough_idx": trough_idx,
        "n_periods": len(arr),
    }


def black_litterman(returns: list[float], cov_matrix: list[list[float]], market_weights: list[float], views: list[float], p_matrix: list[list[float]], tau: float = 0.05) -> dict:
    """Simplified Black-Litterman expected returns."""
    import numpy as np
    
    pi = np.array(returns)
    cov = np.array(cov_matrix)
    w_m = np.array(market_weights)
    Q = np.array(views)
    P = np.array(p_matrix)
    
    # Omega (uncertainty of views) proportional to P * cov * P.T
    omega = np.dot(np.dot(P, cov * tau), P.T)
    if omega.ndim == 0:
        omega = np.array([[omega]])
    elif omega.ndim == 1:
        omega = np.diag(omega)
        
    try:
        omega_inv = np.linalg.inv(omega)
        cov_tau_inv = np.linalg.inv(cov * tau)
        
        # BL formula: [(tau*Cov)^-1 + P^T * Omega^-1 * P]^-1 * [(tau*Cov)^-1 * Pi + P^T * Omega^-1 * Q]
        term1 = np.linalg.inv(cov_tau_inv + np.dot(np.dot(P.T, omega_inv), P))
        term2 = np.dot(cov_tau_inv, pi) + np.dot(np.dot(P.T, omega_inv), Q)
        bl_returns = np.dot(term1, term2)
        
        return {
            "bl_returns": bl_returns.tolist(),
            "prior_returns": pi.tolist()
        }
    except Exception as e:
        return {"error": str(e)}

def risk_parity_weights(cov_matrix: list[list[float]]) -> dict:
    """Equal Risk Contribution (ERC) portfolio weights (inverse volatility approximation)."""
    import numpy as np
    cov = np.array(cov_matrix)
    vols = np.sqrt(np.diag(cov))
    
    inv_vols = 1.0 / vols
    weights = inv_vols / np.sum(inv_vols)
    
    return {
        "weights": weights.tolist()
    }

def hhi_concentration(weights: list[float]) -> dict:
    """Herfindahl-Hirschman Index for portfolio concentration."""
    import numpy as np
    w = np.array(weights)
    hhi = np.sum(w**2) * 10000 # Standard HHI scaling
    
    interpretation = "Highly Concentrated" if hhi > 2500 else "Moderately Concentrated" if hhi > 1500 else "Diversified"
    return {
        "hhi": float(hhi),
        "interpretation": interpretation
    }
