"""QuantRisk OS - Quantitative Market Risk Engine"""
from typing import Optional, List, Tuple
import numpy as np
from scipy import stats
from scipy.optimize import brentq
import pandas as pd

try:
    from arch import arch_model
    ARCH_AVAILABLE = True
except ImportError:
    ARCH_AVAILABLE = False


# ---------------------------------------------------------------------------
# 1. Parametric VaR
# ---------------------------------------------------------------------------

def parametric_var(
    returns: List[float],
    confidence: float = 0.99,
    holding_period: int = 1,
    portfolio_value: float = 1_000_000,
    distribution: str = "normal",
) -> dict:
    """
    Parametric VaR using Normal or Student-t distribution.

    Conventions:
    - returns: daily log-returns or simple returns as decimals (e.g. -0.01 = -1%)
    - VaR reported as a positive dollar loss number
    - Holding period scaling: vol scaled by sqrt(h), mean scaled by h
    - ES computed analytically for Normal; numerically for t
    """
    arr = np.array(returns, dtype=float)
    if len(arr) < 10:
        raise ValueError("Need at least 10 return observations")
    if not 0.5 <= confidence < 1.0:
        raise ValueError("Confidence must be in [0.5, 1.0)")
    if holding_period < 1:
        raise ValueError("Holding period must be >= 1")

    mu_daily = float(np.mean(arr))
    sigma_daily = float(np.std(arr, ddof=1))

    if sigma_daily <= 0:
        raise ValueError("Return series has zero variance")

    mu_h = mu_daily * holding_period
    sigma_h = sigma_daily * np.sqrt(holding_period)

    alpha = 1.0 - confidence  # tail probability

    if distribution == "normal":
        z_alpha = float(stats.norm.ppf(alpha))
        var_return = -(mu_h + z_alpha * sigma_h)
        # ES for Normal: phi(z)/alpha * sigma_h - mu_h
        es_return = float(
            (-mu_h + sigma_h * stats.norm.pdf(stats.norm.ppf(alpha)) / alpha)
        )
        z_used = z_alpha
    elif distribution == "student_t":
        # Estimate degrees of freedom from kurtosis
        excess_kurt = float(stats.kurtosis(arr, fisher=True))
        df_estimated = max(4.0, 6.0 / excess_kurt + 4.0) if excess_kurt > 0 else 10.0
        df_estimated = min(df_estimated, 50.0)
        t_alpha = float(stats.t.ppf(alpha, df=df_estimated))
        # Scale: t distribution has variance df/(df-2)
        scale = np.sqrt((df_estimated - 2) / df_estimated) if df_estimated > 2 else 1.0
        var_return = -(mu_h + t_alpha * sigma_h / scale)
        # ES for t: t_pdf(t_alpha)/alpha * (df+t_alpha^2)/(df-1) * sigma_h/scale - mu_h
        t_pdf_val = stats.t.pdf(t_alpha, df=df_estimated)
        es_return = float(
            -mu_h + (sigma_h / scale) * (t_pdf_val / alpha)
            * (df_estimated + t_alpha ** 2) / (df_estimated - 1)
        )
        z_used = t_alpha
    else:
        raise ValueError(f"Unknown distribution: {distribution}")

    var_dollar = float(var_return * portfolio_value)
    es_dollar = float(es_return * portfolio_value)

    return {
        "var": max(0.0, var_dollar),
        "var_pct": float(var_return * 100),
        "es": max(0.0, es_dollar),
        "es_pct": float(es_return * 100),
        "mu_daily": float(mu_daily),
        "sigma_daily": float(sigma_daily),
        "mu_holding_period": float(mu_h),
        "sigma_holding_period": float(sigma_h),
        "z_alpha": float(z_used),
        "confidence": confidence,
        "holding_period": holding_period,
        "distribution": distribution,
        "n_observations": len(arr),
    }


# ---------------------------------------------------------------------------
# 2. Historical Simulation VaR
# ---------------------------------------------------------------------------

def historical_var(
    returns: List[float],
    confidence: float = 0.99,
    holding_period: int = 1,
    portfolio_value: float = 1_000_000,
    bootstrap: bool = False,
    n_bootstrap: int = 10_000,
    seed: int = 42,
) -> dict:
    """
    Historical simulation VaR.

    For multi-day holding period, uses overlapping-day square-root scaling
    (simple approach: scale by sqrt(h) as approximation).
    For bootstrap: resample with replacement from daily returns.
    """
    arr = np.array(returns, dtype=float)
    if len(arr) < 10:
        raise ValueError("Need at least 10 return observations")

    if bootstrap:
        rng = np.random.default_rng(seed)
        # Block-bootstrap: resample holding_period-day blocks
        resampled = rng.choice(arr, size=(n_bootstrap, holding_period), replace=True)
        period_returns = np.sum(resampled, axis=1)  # compound approx for small returns
    else:
        if holding_period > 1:
            # Overlapping returns for sqrt scaling
            period_returns = arr * np.sqrt(holding_period)
        else:
            period_returns = arr.copy()

    sorted_returns = np.sort(period_returns)
    percentile = (1.0 - confidence) * 100
    var_return = float(-np.percentile(sorted_returns, percentile))

    # ES: mean of all losses worse than VaR
    tail_mask = period_returns <= -var_return
    if tail_mask.sum() == 0:
        es_return = var_return
    else:
        es_return = float(-np.mean(period_returns[tail_mask]))

    var_dollar = var_return * portfolio_value
    es_dollar = es_return * portfolio_value

    return {
        "var": max(0.0, float(var_dollar)),
        "var_pct": float(var_return * 100),
        "es": max(0.0, float(es_dollar)),
        "es_pct": float(es_return * 100),
        "confidence": confidence,
        "holding_period": holding_period,
        "percentile_used": float(percentile),
        "n_observations": len(arr),
        "bootstrap": bootstrap,
        "n_bootstrap": n_bootstrap if bootstrap else None,
        "return_distribution": sorted(period_returns.tolist()),
    }


# ---------------------------------------------------------------------------
# 3. Monte Carlo VaR (GBM)
# ---------------------------------------------------------------------------

def monte_carlo_var(
    portfolio_value: float = 1_000_000,
    mu: float = 0.0,
    sigma: float = 0.01,
    horizon: int = 10,
    n_simulations: int = 10_000,
    confidence: float = 0.99,
    seed: int = 42,
) -> dict:
    """
    Monte Carlo VaR using Geometric Brownian Motion.

    S_T = S_0 * exp((mu - 0.5*sigma^2)*T + sigma*sqrt(T)*Z)
    where mu and sigma are DAILY drift and volatility.
    """
    if sigma <= 0:
        raise ValueError("Sigma must be positive")
    if portfolio_value <= 0:
        raise ValueError("Portfolio value must be positive")

    rng = np.random.default_rng(seed)
    T = horizon / 252.0  # annualize (treating inputs as daily, horizon in days)

    # GBM terminal value
    Z = rng.standard_normal(n_simulations)
    # Using daily compounding over horizon steps
    # S_T = S_0 * exp(sum of daily log-returns)
    # Equivalent: S_T = S_0 * exp((mu - 0.5*sigma^2)*horizon + sigma*sqrt(horizon)*Z)
    log_returns_total = (mu - 0.5 * sigma ** 2) * horizon + sigma * np.sqrt(horizon) * Z
    terminal_values = portfolio_value * np.exp(log_returns_total)
    pnl = terminal_values - portfolio_value

    # VaR as positive loss at confidence percentile
    var_return = float(-np.percentile(pnl, (1 - confidence) * 100))
    var_dollar = max(0.0, var_return)

    # Expected Shortfall
    tail_mask = pnl <= -var_dollar
    if tail_mask.sum() == 0:
        es_dollar = var_dollar
    else:
        es_dollar = float(max(0.0, -np.mean(pnl[tail_mask])))

    # Return up to 5000 simulated PnL values for visualization
    sample_pnl = pnl[:5000].tolist() if len(pnl) > 5000 else pnl.tolist()

    return {
        "var": var_dollar,
        "var_pct": float(var_dollar / portfolio_value * 100),
        "es": es_dollar,
        "es_pct": float(es_dollar / portfolio_value * 100),
        "simulated_pnl": sample_pnl,
        "mean_pnl": float(np.mean(pnl)),
        "std_pnl": float(np.std(pnl)),
        "min_pnl": float(np.min(pnl)),
        "max_pnl": float(np.max(pnl)),
        "confidence": confidence,
        "horizon": horizon,
        "n_simulations": n_simulations,
        "mu_daily": mu,
        "sigma_daily": sigma,
    }


# ---------------------------------------------------------------------------
# 4. EWMA Volatility
# ---------------------------------------------------------------------------

def ewma_volatility(
    returns: List[float],
    lambda_: float = 0.94,
) -> dict:
    """
    EWMA volatility (RiskMetrics approach).

    sigma^2_t = lambda * sigma^2_{t-1} + (1-lambda) * r^2_{t-1}
    Initialized with variance of first 30 returns.
    """
    arr = np.array(returns, dtype=float)
    if len(arr) < 30:
        raise ValueError("Need at least 30 return observations for EWMA")
    if not 0 < lambda_ < 1:
        raise ValueError("Lambda must be in (0, 1)")

    # Initialize with sample variance of first observations
    sigma2 = float(np.var(arr[:min(30, len(arr))], ddof=1))

    ewma_variances = []
    for r in arr:
        sigma2 = lambda_ * sigma2 + (1 - lambda_) * r ** 2
        ewma_variances.append(sigma2)

    vol_daily = float(np.sqrt(ewma_variances[-1]))
    vol_annual = vol_daily * np.sqrt(252)

    return {
        "volatility_daily": vol_daily,
        "volatility_annual": vol_annual,
        "lambda": lambda_,
        "variance_series": ewma_variances,
        "n_observations": len(arr),
    }


# ---------------------------------------------------------------------------
# 5. GARCH(1,1)
# ---------------------------------------------------------------------------

def garch_volatility(returns: List[float]) -> dict:
    """
    GARCH(1,1) parameter estimation using arch library.

    Specification: sigma^2_t = omega + alpha * r^2_{t-1} + beta * sigma^2_{t-1}
    Returns in % terms for arch library convention (auto-scaled).
    """
    if not ARCH_AVAILABLE:
        raise ValueError("arch library not available. Install with: pip install arch")

    arr = np.array(returns, dtype=float)
    if len(arr) < 50:
        raise ValueError("Need at least 50 return observations for GARCH")

    # arch expects returns in % for numerical stability
    returns_pct = arr * 100

    model = arch_model(returns_pct, vol="Garch", p=1, q=1, mean="Constant", dist="Normal")
    result = model.fit(disp="off", show_warning=False)

    params = result.params
    omega = float(params.get("omega", params.iloc[1]))
    alpha = float(params.get("alpha[1]", params.iloc[2]))
    beta = float(params.get("beta[1]", params.iloc[3]))

    # Unconditional variance in % terms -> daily vol
    unconditional_var_pct2 = omega / (1 - alpha - beta) if (alpha + beta) < 1 else float("nan")
    # Latest conditional variance from fitted model (in % terms)
    cond_vol_pct = float(result.conditional_volatility.iloc[-1])
    vol_daily = cond_vol_pct / 100.0
    vol_annual = vol_daily * np.sqrt(252)

    return {
        "volatility_daily": vol_daily,
        "volatility_annual": vol_annual,
        "omega": omega / 10_000,  # convert back from % scaling
        "alpha": alpha,
        "beta": beta,
        "persistence": float(alpha + beta),
        "log_likelihood": float(result.loglikelihood),
        "aic": float(result.aic),
        "bic": float(result.bic),
        "n_observations": len(arr),
    }


# ---------------------------------------------------------------------------
# 6. Historical Volatility
# ---------------------------------------------------------------------------

def historical_volatility(
    returns: List[float],
    annualize: bool = True,
) -> dict:
    """Simple historical (realized) volatility."""
    arr = np.array(returns, dtype=float)
    if len(arr) < 2:
        raise ValueError("Need at least 2 observations")

    vol_daily = float(np.std(arr, ddof=1))
    vol_annual = vol_daily * np.sqrt(252) if annualize else vol_daily

    return {
        "volatility_daily": vol_daily,
        "volatility_annual": vol_annual,
        "mean_return": float(np.mean(arr)),
        "n_observations": len(arr),
    }


# ---------------------------------------------------------------------------
# 7. Black-Scholes-Merton
# ---------------------------------------------------------------------------

def black_scholes(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
) -> dict:
    """
    Black-Scholes-Merton European option pricing and Greeks.

    Conventions:
    - T in years
    - r, q continuous rates
    - sigma annual volatility
    - Theta returned per calendar day (divide by 365)
    - Vega per 1% change in volatility (divide result by 100 for per-unit)
    """
    if S <= 0:
        raise ValueError("Spot price must be positive")
    if K <= 0:
        raise ValueError("Strike must be positive")
    if T <= 0:
        raise ValueError("Maturity must be positive")
    if sigma <= 0:
        raise ValueError("Volatility must be positive")

    d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    N = stats.norm.cdf
    n = stats.norm.pdf

    if option_type.lower() == "call":
        price = S * np.exp(-q * T) * N(d1) - K * np.exp(-r * T) * N(d2)
        delta = float(np.exp(-q * T) * N(d1))
        theta = float(
            (-S * np.exp(-q * T) * n(d1) * sigma / (2 * np.sqrt(T))
             - r * K * np.exp(-r * T) * N(d2)
             + q * S * np.exp(-q * T) * N(d1)) / 365
        )
        rho = float(K * T * np.exp(-r * T) * N(d2) / 100)
    elif option_type.lower() == "put":
        price = K * np.exp(-r * T) * N(-d2) - S * np.exp(-q * T) * N(-d1)
        delta = float(-np.exp(-q * T) * N(-d1))
        theta = float(
            (-S * np.exp(-q * T) * n(d1) * sigma / (2 * np.sqrt(T))
             + r * K * np.exp(-r * T) * N(-d2)
             - q * S * np.exp(-q * T) * N(-d1)) / 365
        )
        rho = float(-K * T * np.exp(-r * T) * N(-d2) / 100)
    else:
        raise ValueError(f"Unknown option type: {option_type}")

    gamma = float(np.exp(-q * T) * n(d1) / (S * sigma * np.sqrt(T)))
    vega = float(S * np.exp(-q * T) * n(d1) * np.sqrt(T) / 100)

    return {
        "price": float(price),
        "delta": delta,
        "gamma": gamma,
        "vega": vega,
        "theta": theta,
        "rho": rho,
        "d1": float(d1),
        "d2": float(d2),
        "intrinsic_value": float(max(0, (S - K) if option_type == "call" else (K - S))),
        "time_value": float(price - max(0, (S - K) if option_type == "call" else (K - S))),
        "moneyness": float(S / K),
    }


# ---------------------------------------------------------------------------
# 8. Implied Volatility (Brent's method)
# ---------------------------------------------------------------------------

def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    q: float = 0.0,
    option_type: str = "call",
) -> dict:
    """
    Solve for implied volatility using Brent's method.

    Validates:
    - Intrinsic value bounds
    - Upper bound from put-call parity / no-arbitrage
    - Convergence
    """
    if T <= 0:
        raise ValueError("Maturity must be positive")

    intrinsic = max(0.0, (S - K) if option_type == "call" else (K - S))
    if market_price < intrinsic - 1e-6:
        raise ValueError(
            f"Market price {market_price:.4f} below intrinsic value {intrinsic:.4f}"
        )

    # Upper bound: call <= S (put <= K), so implied vol must be finite
    upper_bound_price = S if option_type == "call" else K
    if market_price >= upper_bound_price:
        raise ValueError(f"Market price exceeds theoretical upper bound {upper_bound_price}")

    def objective(sigma):
        result = black_scholes(S, K, T, r, sigma, q, option_type)
        return result["price"] - market_price

    # Check sign change
    try:
        low_val = objective(1e-6)
        high_val = objective(10.0)
    except Exception as e:
        return {"implied_vol": None, "converged": False, "error": str(e)}

    if low_val * high_val > 0:
        return {
            "implied_vol": None,
            "converged": False,
            "error": "No sign change found in [1e-6, 10.0] — no unique implied vol",
        }

    try:
        iv = brentq(objective, 1e-6, 10.0, xtol=1e-8, maxiter=1000)
        return {
            "implied_vol": float(iv),
            "implied_vol_pct": float(iv * 100),
            "converged": True,
        }
    except Exception as e:
        return {"implied_vol": None, "converged": False, "error": str(e)}


# ---------------------------------------------------------------------------
# 9. Volatility Surface
# ---------------------------------------------------------------------------

def volatility_surface_data(
    S: float,
    strikes: List[float],
    maturities: List[float],
    r: float = 0.05,
    q: float = 0.0,
    market_prices_matrix: Optional[List[List[float]]] = None,
) -> dict:
    """
    Compute implied volatility surface.

    If market_prices_matrix not provided, generates a realistic synthetic surface
    using a parameterized skew model:
    IV(K, T) = atm_vol * (1 + skew * (log(K/S)) + smile * (log(K/S))^2) / sqrt(T^0.5)
    """
    strikes_arr = np.array(strikes)
    maturities_arr = np.array(maturities)

    if len(strikes) < 2 or len(maturities) < 2:
        raise ValueError("Need at least 2 strikes and 2 maturities")

    iv_surface = []

    if market_prices_matrix is not None:
        # Compute IVs from provided market prices
        for i, K in enumerate(strikes):
            row = []
            for j, T in enumerate(maturities):
                try:
                    mp = market_prices_matrix[i][j]
                    result = implied_volatility(mp, S, K, T, r, q, "call")
                    iv = result.get("implied_vol") or float("nan")
                except Exception:
                    iv = float("nan")
                row.append(iv)
            iv_surface.append(row)
    else:
        # Generate synthetic realistic surface
        atm_vol = 0.20  # 20% ATM vol
        for K in strikes:
            row = []
            log_moneyness = np.log(K / S)
            for T in maturities:
                # Realistic vol surface: negative skew, positive smile, term structure
                skew = -0.15  # negative skew (equity markets)
                smile = 0.25  # positive smile coefficient
                term_struct = 0.02 * np.sqrt(T)  # slight upward term structure
                iv = atm_vol * (1 + skew * log_moneyness + smile * log_moneyness ** 2) + term_struct
                iv = max(0.01, iv)  # floor at 1%
                row.append(float(iv))
            iv_surface.append(row)

    return {
        "strikes": [float(k) for k in strikes],
        "maturities": [float(t) for t in maturities],
        "iv_surface": iv_surface,
        "spot": float(S),
        "synthetic": market_prices_matrix is None,
    }
