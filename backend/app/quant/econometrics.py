"""QuantRisk OS - Econometrics Engine"""
from typing import List, Optional, Literal
import numpy as np
from scipy import stats
import pandas as pd
import warnings

try:
    import statsmodels.api as sm
    from statsmodels.tsa.stattools import adfuller, acf, pacf
    from statsmodels.stats.diagnostic import het_breuschpagan, acorr_breusch_godfrey
    from statsmodels.stats.stattools import durbin_watson
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False


def _require_statsmodels():
    if not STATSMODELS_AVAILABLE:
        raise ValueError("statsmodels not available. Install with: pip install statsmodels")


# ---------------------------------------------------------------------------
# 1. ADF Test
# ---------------------------------------------------------------------------

def adf_test(
    series: List[float],
    maxlag: Optional[int] = None,
    regression: str = "c",
) -> dict:
    """
    Augmented Dickey-Fuller unit root test.

    H0: series has a unit root (non-stationary)
    H1: series is stationary

    Regression options:
    - 'c': constant (most common for financial series)
    - 'ct': constant + trend
    - 'ctt': constant + linear + quadratic trend
    - 'n': no constant or trend
    """
    _require_statsmodels()
    arr = np.array(series, dtype=float)
    if len(arr) < 20:
        raise ValueError("ADF test requires at least 20 observations")

    valid_regressions = ["c", "ct", "ctt", "n"]
    if regression not in valid_regressions:
        raise ValueError(f"regression must be one of {valid_regressions}")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = adfuller(arr, maxlag=maxlag, regression=regression, autolag="AIC")

    adf_stat = float(result[0])
    p_value = float(result[1])
    used_lag = int(result[2])
    n_obs = int(result[3])
    critical_values = {k: float(v) for k, v in result[4].items()}
    icbest = float(result[5]) if result[5] is not None else None

    # Interpret at 5% level
    if p_value < 0.01:
        interpretation = "Reject H0 at 1% significance. Series appears stationary."
    elif p_value < 0.05:
        interpretation = "Reject H0 at 5% significance. Series appears stationary."
    elif p_value < 0.10:
        interpretation = "Reject H0 at 10% significance. Weak evidence of stationarity."
    else:
        interpretation = "Fail to reject H0. Series likely has a unit root (non-stationary)."

    return {
        "statistic": adf_stat,
        "pvalue": p_value,
        "usedlag": used_lag,
        "nobs": n_obs,
        "critical_values": critical_values,
        "icbest": icbest,
        "regression": regression,
        "interpretation": interpretation,
    }


# ---------------------------------------------------------------------------
# 2. ACF / PACF
# ---------------------------------------------------------------------------

def acf_pacf(series: List[float], nlags: int = 40) -> dict:
    """
    Autocorrelation and Partial Autocorrelation Functions.

    Used for ARIMA model identification.
    Confidence bands at ±1.96/sqrt(n) (approximate 95% CI for white noise).
    """
    _require_statsmodels()
    arr = np.array(series, dtype=float)
    n = len(arr)
    if n < 20:
        raise ValueError("Need at least 20 observations")

    nlags = min(nlags, n // 2 - 1)

    acf_values, acf_ci = acf(arr, nlags=nlags, alpha=0.05, fft=True)
    pacf_values, pacf_ci = pacf(arr, nlags=nlags, alpha=0.05, method="ywm")

    return {
        "acf": acf_values.tolist(),
        "pacf": pacf_values.tolist(),
        "lags": list(range(nlags + 1)),
        "acf_confint": acf_ci.tolist(),
        "pacf_confint": pacf_ci.tolist(),
        "significance_bound": float(1.96 / np.sqrt(n)),
        "n_observations": n,
    }


# ---------------------------------------------------------------------------
# 3. Descriptive Statistics
# ---------------------------------------------------------------------------

def descriptive_stats(series: List[float]) -> dict:
    """
    Comprehensive descriptive statistics for a financial time series.

    Excess kurtosis: kurtosis - 3 (normal = 0)
    Jarque-Bera: tests normality
    """
    arr = np.array(series, dtype=float)
    if len(arr) < 4:
        raise ValueError("Need at least 4 observations")

    mean = float(np.mean(arr))
    var = float(np.var(arr, ddof=1))
    std = float(np.std(arr, ddof=1))
    skewness = float(stats.skew(arr, bias=False))
    kurtosis = float(stats.kurtosis(arr, fisher=False, bias=False))  # non-excess
    excess_kurtosis = kurtosis - 3.0
    minimum = float(np.min(arr))
    maximum = float(np.max(arr))
    median = float(np.median(arr))
    q25 = float(np.percentile(arr, 25))
    q75 = float(np.percentile(arr, 75))

    # Jarque-Bera test
    jb_stat, jb_pvalue = stats.jarque_bera(arr)

    # Shapiro-Wilk (only for small samples)
    if len(arr) <= 5000:
        sw_stat, sw_pvalue = stats.shapiro(arr)
    else:
        sw_stat, sw_pvalue = None, None

    return {
        "mean": mean,
        "variance": var,
        "std": std,
        "skewness": skewness,
        "kurtosis": kurtosis,
        "excess_kurtosis": excess_kurtosis,
        "min": minimum,
        "max": maximum,
        "median": median,
        "q25": q25,
        "q75": q75,
        "iqr": float(q75 - q25),
        "n": len(arr),
        "jarque_bera_stat": float(jb_stat),
        "jarque_bera_pvalue": float(jb_pvalue),
        "shapiro_wilk_stat": float(sw_stat) if sw_stat is not None else None,
        "shapiro_wilk_pvalue": float(sw_pvalue) if sw_pvalue is not None else None,
        "normality_interpretation": (
            "Distribution appears non-normal (JB p < 0.05)" if jb_pvalue < 0.05
            else "Cannot reject normality at 5% (JB p >= 0.05)"
        ),
        "annualized_return": float(mean * 252),
        "annualized_vol": float(std * np.sqrt(252)),
    }


# ---------------------------------------------------------------------------
# 4. OLS Regression
# ---------------------------------------------------------------------------

def ols_regression(
    y: List[float],
    X: List[List[float]],
    feature_names: List[str],
    add_constant: bool = True,
) -> dict:
    """
    OLS Regression using statsmodels.

    Returns full summary: coefficients, SEs, t-stats, p-values, R², diagnostics.
    """
    _require_statsmodels()
    y_arr = np.array(y, dtype=float)
    X_arr = np.array(X, dtype=float)

    if X_arr.ndim == 1:
        X_arr = X_arr.reshape(-1, 1)

    if len(y_arr) != len(X_arr):
        raise ValueError(f"y and X must have same number of rows: {len(y_arr)} vs {len(X_arr)}")

    if len(feature_names) != X_arr.shape[1]:
        raise ValueError(
            f"feature_names length {len(feature_names)} != X columns {X_arr.shape[1]}"
        )

    if add_constant:
        X_model = sm.add_constant(X_arr)
        names = ["const"] + list(feature_names)
    else:
        X_model = X_arr
        names = list(feature_names)

    model = sm.OLS(y_arr, X_model)
    result = model.fit()

    coefficients = {n: float(v) for n, v in zip(names, result.params)}
    std_errors = {n: float(v) for n, v in zip(names, result.bse)}
    t_stats = {n: float(v) for n, v in zip(names, result.tvalues)}
    p_values = {n: float(v) for n, v in zip(names, result.pvalues)}
    _ci = result.conf_int()
    # statsmodels may return DataFrame or ndarray depending on version
    if hasattr(_ci, "iloc"):
        conf_int = {n: [float(_ci.iloc[i, 0]), float(_ci.iloc[i, 1])] for i, n in enumerate(names)}
    else:
        _ci_arr = np.array(_ci)
        conf_int = {n: [float(_ci_arr[i, 0]), float(_ci_arr[i, 1])] for i, n in enumerate(names)}

    return {
        "coefficients": coefficients,
        "std_errors": std_errors,
        "t_stats": t_stats,
        "p_values": p_values,
        "r_squared": float(result.rsquared),
        "adj_r_squared": float(result.rsquared_adj),
        "f_statistic": float(result.fvalue) if result.fvalue is not None else None,
        "f_pvalue": float(result.f_pvalue) if result.f_pvalue is not None else None,
        "aic": float(result.aic),
        "bic": float(result.bic),
        "conf_intervals": conf_int,
        "n_obs": int(result.nobs),
        "residuals": result.resid.tolist(),
        "fitted_values": result.fittedvalues.tolist(),
        "feature_names": names,
    }


# ---------------------------------------------------------------------------
# 5. Heteroskedasticity & Serial Correlation Diagnostics
# ---------------------------------------------------------------------------

def regression_diagnostics(
    y: List[float],
    X: List[List[float]],
) -> dict:
    """
    Post-estimation regression diagnostics:
    - Breusch-Pagan heteroskedasticity test
    - Durbin-Watson serial correlation
    - Breusch-Godfrey serial correlation
    """
    _require_statsmodels()
    y_arr = np.array(y, dtype=float)
    X_arr = np.array(X, dtype=float)

    if X_arr.ndim == 1:
        X_arr = X_arr.reshape(-1, 1)

    X_model = sm.add_constant(X_arr)
    model = sm.OLS(y_arr, X_model)
    result = model.fit()
    residuals = result.resid

    # Breusch-Pagan
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        bp_stat, bp_pvalue, bp_fstat, bp_fpvalue = het_breuschpagan(residuals, X_model)

    # Durbin-Watson
    dw_stat = float(durbin_watson(residuals))

    # Breusch-Godfrey (lag=1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        bg_stat, bg_pvalue, bg_fstat, bg_fpvalue = acorr_breusch_godfrey(result, nlags=1)

    def _interp_bp(p):
        if p < 0.05:
            return "Reject H0: evidence of heteroskedasticity (p < 0.05)"
        return "Cannot reject H0: no strong evidence of heteroskedasticity (p >= 0.05)"

    def _interp_dw(stat):
        if stat < 1.5:
            return "Positive serial correlation likely (DW < 1.5)"
        elif stat > 2.5:
            return "Negative serial correlation possible (DW > 2.5)"
        return "No strong serial correlation (DW ≈ 2)"

    def _interp_bg(p):
        if p < 0.05:
            return "Reject H0: serial correlation detected (p < 0.05)"
        return "Cannot reject H0: no strong serial correlation (p >= 0.05)"

    return {
        "breusch_pagan": {
            "statistic": float(bp_stat),
            "pvalue": float(bp_pvalue),
            "f_statistic": float(bp_fstat),
            "f_pvalue": float(bp_fpvalue),
            "interpretation": _interp_bp(bp_pvalue),
        },
        "durbin_watson": {
            "statistic": dw_stat,
            "interpretation": _interp_dw(dw_stat),
        },
        "breusch_godfrey": {
            "statistic": float(bg_stat),
            "pvalue": float(bg_pvalue),
            "interpretation": _interp_bg(bg_pvalue),
        },
        "n_obs": len(y_arr),
    }


# ---------------------------------------------------------------------------
# 6. VIF Analysis
# ---------------------------------------------------------------------------

def vif_analysis(
    X: List[List[float]],
    feature_names: List[str],
) -> dict:
    """
    Variance Inflation Factor (VIF) for multicollinearity.

    VIF_i = 1 / (1 - R^2_i) where R^2_i is from regressing X_i on all other X.
    - VIF < 5: acceptable
    - 5 <= VIF < 10: moderate multicollinearity
    - VIF >= 10: high multicollinearity
    """
    _require_statsmodels()
    X_arr = np.array(X, dtype=float)
    if X_arr.ndim == 1:
        X_arr = X_arr.reshape(-1, 1)

    if len(feature_names) != X_arr.shape[1]:
        raise ValueError("feature_names length must match X columns")

    X_with_const = sm.add_constant(X_arr)

    vif_values = {}
    interpretations = {}
    for i, name in enumerate(feature_names):
        vif_val = float(variance_inflation_factor(X_with_const, i + 1))  # +1 for const
        vif_values[name] = vif_val
        if vif_val < 5:
            interp = "Low: acceptable multicollinearity"
        elif vif_val < 10:
            interp = "Moderate: multicollinearity may affect coefficient estimates"
        else:
            interp = "High: severe multicollinearity — consider removing or combining features"
        interpretations[name] = interp

    return {
        "vif": vif_values,
        "interpretation": interpretations,
        "n_features": len(feature_names),
        "feature_names": feature_names,
    }
