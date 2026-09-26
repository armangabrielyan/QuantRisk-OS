"""QuantRisk OS - Credit Risk Engine"""
from typing import List, Optional
import numpy as np
from scipy import stats
import pandas as pd

try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score, roc_curve, confusion_matrix
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


# ---------------------------------------------------------------------------
# 1. Expected Loss
# ---------------------------------------------------------------------------

def expected_loss(exposures: List[dict]) -> dict:
    """
    Compute Expected Loss = PD × LGD × EAD for a portfolio.

    Each exposure dict: {name, pd, lgd, ead}
    EL = PD × LGD × EAD per exposure.
    Portfolio EL = sum of individual ELs.
    Weighted avg PD = sum(EL_i) / sum(EAD_i * LGD_i)
    """
    if not exposures:
        raise ValueError("At least one exposure required")

    results = []
    total_ead = 0.0
    total_el = 0.0
    total_ead_lgd = 0.0

    for exp in exposures:
        pd_val = float(exp["pd"])
        lgd_val = float(exp["lgd"])
        ead_val = float(exp["ead"])

        if not 0 <= pd_val <= 1:
            raise ValueError(f"PD must be in [0, 1], got {pd_val}")
        if not 0 <= lgd_val <= 1:
            raise ValueError(f"LGD must be in [0, 1], got {lgd_val}")
        if ead_val <= 0:
            raise ValueError(f"EAD must be positive, got {ead_val}")

        el = pd_val * lgd_val * ead_val
        results.append({
            "name": exp.get("name", "Unknown"),
            "pd": pd_val,
            "lgd": lgd_val,
            "ead": ead_val,
            "el": float(el),
            "el_pct": float(el / ead_val * 100) if ead_val > 0 else 0.0,
        })
        total_ead += ead_val
        total_el += el
        total_ead_lgd += ead_val * lgd_val

    weighted_avg_pd = (total_el / total_ead_lgd) if total_ead_lgd > 0 else 0.0
    weighted_avg_lgd = (total_ead_lgd / total_ead) if total_ead > 0 else 0.0

    return {
        "total_el": float(total_el),
        "total_ead": float(total_ead),
        "total_el_pct": float(total_el / total_ead * 100) if total_ead > 0 else 0.0,
        "weighted_avg_pd": float(weighted_avg_pd),
        "weighted_avg_lgd": float(weighted_avg_lgd),
        "n_exposures": len(results),
        "exposures": results,
    }


# ---------------------------------------------------------------------------
# 2. Merton Structural Model
# ---------------------------------------------------------------------------

def merton_model(
    asset_value: float,
    asset_volatility: float,
    debt: float,
    maturity: float,
    risk_free_rate: float,
) -> dict:
    """
    Merton (1974) structural model for credit risk.

    Models equity as a call option on firm assets:
    E = V * N(d1) - D * exp(-r*T) * N(d2)

    Distance to Default (DD) = (ln(V/D) + (r - 0.5*sigma_V^2)*T) / (sigma_V * sqrt(T))
    Probability of Default (risk-neutral) = N(-d2) = N(-DD)

    Physical PD uses a risk premium adjustment.
    """
    V = asset_value
    sigma_V = asset_volatility
    D = debt
    T = maturity
    r = risk_free_rate

    if V <= 0:
        raise ValueError("Asset value must be positive")
    if sigma_V <= 0:
        raise ValueError("Asset volatility must be positive")
    if D <= 0:
        raise ValueError("Debt must be positive")
    if T <= 0:
        raise ValueError("Maturity must be positive")

    # d1 and d2 for Merton model
    d1 = (np.log(V / D) + (r + 0.5 * sigma_V ** 2) * T) / (sigma_V * np.sqrt(T))
    d2 = d1 - sigma_V * np.sqrt(T)

    # Equity value (call on assets)
    equity_value = V * stats.norm.cdf(d1) - D * np.exp(-r * T) * stats.norm.cdf(d2)

    # Risk-neutral PD
    pd_risk_neutral = float(stats.norm.cdf(-d2))

    # Distance to Default
    dd = float(d2)

    # Leverage ratio
    leverage = float(D / V)

    # Implied credit spread (simplified)
    # Spread = -ln(N(d2) + (V/D)*exp(-r*T)*N(d1)) / T (approximate)
    bond_price = D * np.exp(-r * T) * stats.norm.cdf(d2) + V * stats.norm.cdf(-d1)
    implied_spread = float(-np.log(bond_price / (D * np.exp(-r * T))) / T) if bond_price > 0 else float("nan")

    return {
        "distance_to_default": dd,
        "pd": pd_risk_neutral,
        "pd_pct": float(pd_risk_neutral * 100),
        "equity_value": float(equity_value),
        "asset_value": float(V),
        "debt_pv": float(D * np.exp(-r * T)),
        "leverage_ratio": leverage,
        "d1": float(d1),
        "d2": float(d2),
        "implied_credit_spread_bps": float(implied_spread * 10_000) if not np.isnan(implied_spread) else None,
    }


# ---------------------------------------------------------------------------
# 3. Credit Scoring Pipeline
# ---------------------------------------------------------------------------

def credit_scoring_pipeline(
    data: List[dict],
    target_col: str,
    feature_cols: List[str],
    test_size: float = 0.2,
    seed: int = 42,
) -> dict:
    """
    Logistic regression credit scoring pipeline.

    Steps:
    1. Validate columns
    2. Train/test split
    3. Standardize features
    4. Fit logistic regression
    5. Return: AUC, Gini, ROC, coefficients, confusion matrix, PD predictions
    """
    if not SKLEARN_AVAILABLE:
        raise ValueError("scikit-learn not available. Install with: pip install scikit-learn")

    df = pd.DataFrame(data)

    # Validate columns
    missing_cols = [c for c in feature_cols + [target_col] if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing columns in data: {missing_cols}")

    # Drop NAs
    df = df[feature_cols + [target_col]].dropna()
    if len(df) < 20:
        raise ValueError(f"Insufficient data after dropping NAs: {len(df)} rows")

    # Ensure numeric
    for col in feature_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df[target_col] = pd.to_numeric(df[target_col], errors="coerce")
    df = df.dropna()

    X = df[feature_cols].values
    y = df[target_col].values.astype(int)

    if len(np.unique(y)) < 2:
        raise ValueError("Target variable must have at least 2 classes")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=y
    )

    # Standardize
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Fit logistic regression
    model = LogisticRegression(max_iter=500, random_state=seed, solver="lbfgs")
    model.fit(X_train_scaled, y_train)

    # Predictions
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
    y_pred = model.predict(X_test_scaled)

    # Metrics
    auc = float(roc_auc_score(y_test, y_pred_proba))
    gini = float(2 * auc - 1)

    fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Coefficients (unscaled for interpretability)
    raw_coefs = model.coef_[0]
    intercept = float(model.intercept_[0])
    # Unstandardize: coef_unscaled = coef_scaled / std(X)
    stds = scaler.scale_
    coefs_unscaled = raw_coefs / stds

    coefficients = {name: float(coef) for name, coef in zip(feature_cols, coefs_unscaled)}
    coef_scaled = {name: float(coef) for name, coef in zip(feature_cols, raw_coefs)}

    # Odds ratios
    odds_ratios = {name: float(np.exp(coef)) for name, coef in coefficients.items()}

    return {
        "auc": auc,
        "gini": gini,
        "intercept": intercept,
        "coefficients": coefficients,
        "coefficients_scaled": coef_scaled,
        "odds_ratios": odds_ratios,
        "confusion_matrix": cm,
        "roc_curve": {
            "fpr": fpr.tolist(),
            "tpr": tpr.tolist(),
            "thresholds": thresholds.tolist(),
        },
        "test_pds": y_pred_proba.tolist(),
        "test_actuals": y_test.tolist(),
        "n_train": len(y_train),
        "n_test": len(y_test),
        "default_rate": float(y.mean()),
        "feature_names": feature_cols,
    }
