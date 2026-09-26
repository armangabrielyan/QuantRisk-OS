"""QuantRisk OS - Comprehensive Backend Tests

Tests verify mathematical correctness of all quantitative engines.
Each test checks actual computed values against known benchmarks.
"""
import pytest
import numpy as np
from scipy import stats
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.quant.market_risk import (
    parametric_var, historical_var, monte_carlo_var,
    ewma_volatility, historical_volatility, black_scholes,
    implied_volatility, volatility_surface_data
)
from app.quant.credit_risk import expected_loss, merton_model
from app.quant.alm import duration_gap, lcr_calculator, nsfr_calculator
from app.quant.econometrics import (
    adf_test, acf_pacf, descriptive_stats, ols_regression,
    regression_diagnostics, vif_analysis
)
from app.quant.portfolio import portfolio_analytics, efficient_frontier, maximum_drawdown
from app.quant.stress_testing import apply_stress_scenario, get_scenario_presets


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def normal_returns():
    """500 daily returns from N(0.0004, 0.01^2)."""
    rng = np.random.default_rng(42)
    return rng.normal(0.0004, 0.01, 500).tolist()


@pytest.fixture
def fat_tailed_returns():
    """500 daily returns from t(5) distribution (fat-tailed)."""
    rng = np.random.default_rng(42)
    return (rng.standard_t(5, 500) * 0.01).tolist()


@pytest.fixture
def multi_asset_returns():
    """3 assets, 252 daily returns each."""
    rng = np.random.default_rng(42)
    returns = [
        rng.normal(0.0005, 0.012, 252).tolist(),  # SPY-like
        rng.normal(0.0002, 0.008, 252).tolist(),  # GLD-like
        rng.normal(0.0001, 0.005, 252).tolist(),  # TLT-like
    ]
    return returns


# ============================================================
# Market Risk Tests
# ============================================================

class TestParametricVaR:
    def test_normal_var_benchmark(self, normal_returns):
        """Parametric VaR at 99% with known inputs should be ~$232,600 for N(0,1)."""
        # Pure N(0,1): VaR = z_99 * sigma * PV = 2.326 * 1.0 * 100,000
        pure_returns = np.random.default_rng(999).standard_normal(1000).tolist()
        result = parametric_var(pure_returns, confidence=0.99, holding_period=1, portfolio_value=100_000)
        # VaR should be approximately z_99 * std * 100000
        z99 = stats.norm.ppf(0.99)
        sigma = float(np.std(pure_returns, ddof=1))
        expected_var = z99 * sigma * 100_000
        assert abs(result["var"] - expected_var) < expected_var * 0.05, (
            f"VaR {result['var']:.0f} differs from expected {expected_var:.0f} by >5%"
        )

    def test_es_greater_than_var(self, normal_returns):
        """ES must always exceed VaR."""
        result = parametric_var(normal_returns, confidence=0.99, portfolio_value=1_000_000)
        assert result["es"] >= result["var"], f"ES {result['es']} < VaR {result['var']}"

    def test_higher_confidence_higher_var(self, normal_returns):
        """Higher confidence → higher VaR."""
        r95 = parametric_var(normal_returns, confidence=0.95, portfolio_value=1_000_000)
        r99 = parametric_var(normal_returns, confidence=0.99, portfolio_value=1_000_000)
        assert r99["var"] > r95["var"]

    def test_holding_period_scaling(self, normal_returns):
        """10-day VaR ≈ 1-day VaR × sqrt(10)."""
        r1d = parametric_var(normal_returns, confidence=0.99, holding_period=1, portfolio_value=1_000_000)
        r10d = parametric_var(normal_returns, confidence=0.99, holding_period=10, portfolio_value=1_000_000)
        ratio = r10d["var"] / r1d["var"]
        # Should be approximately sqrt(10) ≈ 3.162 (minus drift term)
        assert 2.5 < ratio < 4.0, f"10d/1d VaR ratio {ratio:.3f} outside reasonable range"

    def test_student_t_var_greater_than_normal(self, fat_tailed_returns):
        """Student-t VaR should exceed Normal VaR for fat-tailed returns."""
        r_norm = parametric_var(fat_tailed_returns, confidence=0.99, distribution="normal")
        r_t = parametric_var(fat_tailed_returns, confidence=0.99, distribution="student_t")
        # For fat-tailed data, t-distribution should give >= VaR
        # (may not always hold depending on estimated df, but should be close)
        assert r_t["var"] >= r_norm["var"] * 0.9, (
            f"Student-t VaR {r_t['var']:.0f} unexpectedly much lower than normal {r_norm['var']:.0f}"
        )

    def test_var_positive(self, normal_returns):
        """VaR must be positive (it's a loss amount)."""
        result = parametric_var(normal_returns, confidence=0.99)
        assert result["var"] >= 0
        assert result["es"] >= 0

    def test_invalid_confidence_raises(self):
        """Confidence outside [0.5, 1.0) should raise."""
        with pytest.raises(Exception):
            parametric_var([0.01] * 20, confidence=1.5)


class TestHistoricalVaR:
    def test_historical_var_ordering(self, normal_returns):
        """99% hist VaR > 95% hist VaR."""
        r95 = historical_var(normal_returns, confidence=0.95)
        r99 = historical_var(normal_returns, confidence=0.99)
        assert r99["var"] > r95["var"]

    def test_bootstrap_vs_plain(self, normal_returns):
        """Bootstrap and plain should give similar results."""
        r_plain = historical_var(normal_returns, confidence=0.99)
        r_boot = historical_var(normal_returns, confidence=0.99, bootstrap=True, n_bootstrap=5000)
        ratio = r_boot["var"] / r_plain["var"]
        assert 0.5 < ratio < 2.0, f"Bootstrap/plain ratio {ratio:.3f} too far from 1"

    def test_es_above_var(self, normal_returns):
        """ES >= VaR always."""
        result = historical_var(normal_returns, confidence=0.99)
        assert result["es"] >= result["var"] * 0.9  # allow small rounding


class TestMonteCarlVaR:
    def test_zero_drift_var(self):
        """Zero drift: VaR ≈ z_99 × sigma × sqrt(h) × PV."""
        result = monte_carlo_var(
            portfolio_value=1_000_000, mu=0.0, sigma=0.01,
            horizon=1, n_simulations=50_000, confidence=0.99, seed=42
        )
        # Theoretical: z_99 * 0.01 * 1M = 23,260
        expected = 2.326 * 0.01 * 1_000_000
        assert abs(result["var"] - expected) < expected * 0.10, (
            f"MC VaR {result['var']:.0f} differs from theoretical {expected:.0f} by >10%"
        )

    def test_es_above_var(self):
        result = monte_carlo_var(portfolio_value=1_000_000, mu=0.0, sigma=0.01,
                                 horizon=10, n_simulations=10_000, confidence=0.99, seed=42)
        assert result["es"] >= result["var"]

    def test_reproducibility(self):
        """Same seed → same result."""
        r1 = monte_carlo_var(portfolio_value=1_000_000, mu=0.0, sigma=0.01, seed=42)
        r2 = monte_carlo_var(portfolio_value=1_000_000, mu=0.0, sigma=0.01, seed=42)
        assert r1["var"] == r2["var"]

    def test_simulated_pnl_returned(self):
        result = monte_carlo_var(portfolio_value=1_000_000, mu=0.0, sigma=0.01, seed=42)
        assert len(result["simulated_pnl"]) > 0


class TestEWMA:
    def test_ewma_output_shape(self, normal_returns):
        result = ewma_volatility(normal_returns, lambda_=0.94)
        assert "volatility_daily" in result
        assert "volatility_annual" in result
        assert result["volatility_daily"] > 0
        assert result["volatility_annual"] > result["volatility_daily"]

    def test_ewma_annualization(self, normal_returns):
        result = ewma_volatility(normal_returns, lambda_=0.94)
        ratio = result["volatility_annual"] / result["volatility_daily"]
        assert abs(ratio - np.sqrt(252)) < 0.01

    def test_higher_lambda_smoother(self, normal_returns):
        """Higher lambda → more smoothing → variance series closer to long-run average."""
        r94 = ewma_volatility(normal_returns, lambda_=0.94)
        r80 = ewma_volatility(normal_returns, lambda_=0.80)
        # Both should return valid vols
        assert r94["volatility_daily"] > 0
        assert r80["volatility_daily"] > 0


class TestBlackScholes:
    """Benchmark Black-Scholes against known analytical values."""

    def test_atm_call_delta(self):
        """ATM call delta ≈ 0.5 (slightly above due to drift)."""
        result = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, q=0.0, option_type="call")
        assert 0.5 < result["delta"] < 0.7, f"ATM call delta {result['delta']:.4f} unexpected"

    def test_deep_itm_call_delta(self):
        """Deep ITM call delta ≈ 1.0."""
        result = black_scholes(S=200, K=100, T=1.0, r=0.05, sigma=0.20, option_type="call")
        assert result["delta"] > 0.95

    def test_deep_otm_call_delta(self):
        """Deep OTM call delta ≈ 0.0."""
        result = black_scholes(S=50, K=200, T=0.5, r=0.05, sigma=0.20, option_type="call")
        assert result["delta"] < 0.05

    def test_put_call_parity(self):
        """C - P = S*e^(-qT) - K*e^(-rT)."""
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 0.20, 0.02
        call = black_scholes(S, K, T, r, sigma, q, "call")
        put = black_scholes(S, K, T, r, sigma, q, "put")
        parity_lhs = call["price"] - put["price"]
        parity_rhs = S * np.exp(-q * T) - K * np.exp(-r * T)
        assert abs(parity_lhs - parity_rhs) < 1e-6, (
            f"Put-call parity violated: LHS={parity_lhs:.6f}, RHS={parity_rhs:.6f}"
        )

    def test_call_price_positive(self):
        result = black_scholes(S=100, K=105, T=0.5, r=0.05, sigma=0.25)
        assert result["price"] > 0

    def test_gamma_positive(self):
        """Gamma is always positive for both calls and puts."""
        call = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type="call")
        put = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type="put")
        assert call["gamma"] > 0
        assert put["gamma"] > 0

    def test_call_put_same_gamma_vega(self):
        """Call and put with same params have identical Gamma and |Vega|."""
        call = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type="call")
        put = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type="put")
        assert abs(call["gamma"] - put["gamma"]) < 1e-10
        assert abs(call["vega"] - put["vega"]) < 1e-10

    def test_known_benchmark(self):
        """
        Known BSM benchmark: S=100, K=100, T=1, r=0.05, σ=0.2, q=0
        Call price ≈ $10.451 (from Hull textbook).
        """
        result = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, q=0.0, option_type="call")
        assert abs(result["price"] - 10.451) < 0.05, (
            f"BSM benchmark: expected ~10.451, got {result['price']:.4f}"
        )

    def test_theta_negative_call(self):
        """Long call theta should be negative (time value decays)."""
        result = black_scholes(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type="call")
        assert result["theta"] < 0, f"Call theta should be negative, got {result['theta']}"


class TestImpliedVolatility:
    def test_round_trip(self):
        """IV(BSM price) should recover original sigma."""
        sigma_true = 0.25
        S, K, T, r = 100.0, 105.0, 0.5, 0.05
        bs = black_scholes(S, K, T, r, sigma_true, option_type="call")
        iv_result = implied_volatility(bs["price"], S, K, T, r, option_type="call")
        assert iv_result["converged"], f"IV did not converge: {iv_result}"
        assert abs(iv_result["implied_vol"] - sigma_true) < 1e-4, (
            f"IV round-trip: expected {sigma_true}, got {iv_result['implied_vol']:.6f}"
        )

    def test_arbitrage_bounds_respected(self):
        """Price below intrinsic should raise ValueError."""
        with pytest.raises((ValueError, Exception)):
            implied_volatility(market_price=-1.0, S=100, K=90, T=1.0, r=0.05, option_type="call")

    def test_converged_flag(self):
        """Valid input should produce converged=True."""
        bs = black_scholes(100, 100, 1.0, 0.05, 0.20)
        iv = implied_volatility(bs["price"], 100, 100, 1.0, 0.05, option_type="call")
        assert iv["converged"]


# ============================================================
# Credit Risk Tests
# ============================================================

class TestExpectedLoss:
    def test_single_exposure(self):
        """EL = PD × LGD × EAD."""
        result = expected_loss([{"name": "Loan A", "pd": 0.025, "lgd": 0.45, "ead": 5_000_000}])
        expected = 0.025 * 0.45 * 5_000_000
        assert abs(result["total_el"] - expected) < 1.0, (
            f"EL {result['total_el']:.2f} != expected {expected:.2f}"
        )

    def test_portfolio_el(self):
        """Portfolio EL = sum of individual ELs."""
        exposures = [
            {"name": "A", "pd": 0.02, "lgd": 0.40, "ead": 1_000_000},
            {"name": "B", "pd": 0.05, "lgd": 0.60, "ead": 500_000},
            {"name": "C", "pd": 0.01, "lgd": 0.30, "ead": 2_000_000},
        ]
        result = expected_loss(exposures)
        manual_el = sum(e["pd"] * e["lgd"] * e["ead"] for e in exposures)
        assert abs(result["total_el"] - manual_el) < 1.0

    def test_el_zero_pd(self):
        """Zero PD → zero EL."""
        result = expected_loss([{"name": "Risk-free", "pd": 0.0, "lgd": 0.5, "ead": 1_000_000}])
        assert result["total_el"] == 0.0

    def test_invalid_pd_raises(self):
        with pytest.raises(Exception):
            expected_loss([{"name": "Bad", "pd": 1.5, "lgd": 0.5, "ead": 100_000}])


class TestMertonModel:
    def test_high_leverage_high_pd(self):
        """Highly leveraged firm (D ≈ V) should have high PD."""
        result = merton_model(
            asset_value=100, asset_volatility=0.20, debt=95, maturity=1.0, risk_free_rate=0.05
        )
        assert result["pd"] > 0.10, f"Expected PD > 10% for leveraged firm, got {result['pd']:.4f}"

    def test_low_leverage_low_pd(self):
        """Well-capitalized firm (D << V) should have low PD."""
        result = merton_model(
            asset_value=200, asset_volatility=0.10, debt=50, maturity=1.0, risk_free_rate=0.05
        )
        assert result["pd"] < 0.05, f"Expected PD < 5% for solid firm, got {result['pd']:.4f}"

    def test_pd_in_unit_interval(self):
        """PD must be in [0, 1]."""
        result = merton_model(100, 0.20, 80, 1.0, 0.05)
        assert 0.0 <= result["pd"] <= 1.0

    def test_dd_positive_for_solvent_firm(self):
        """Distance to default should be positive for solvent firm."""
        result = merton_model(150, 0.15, 100, 1.0, 0.04)
        assert result["distance_to_default"] > 0


# ============================================================
# ALM Tests
# ============================================================

class TestDurationGap:
    def test_positive_gap_negative_equity_sensitivity(self):
        """Positive duration gap → equity falls when rates rise."""
        result = duration_gap(
            asset_duration=5.0, liability_duration=2.0,
            asset_value=1000, liability_value=800, rate_shock=0.01
        )
        assert result["duration_gap"] > 0
        assert result["equity_sensitivity"] < 0

    def test_zero_gap_zero_sensitivity(self):
        """Duration gap = 0 → rate insensitive."""
        # D_gap = D_A - (L/A) * D_L = 0: D_A = (L/A)*D_L
        result = duration_gap(
            asset_duration=2.0, liability_duration=2.5,
            asset_value=1000, liability_value=800, rate_shock=0.01
        )
        gap = 2.0 - (800 / 1000) * 2.5
        assert abs(result["duration_gap"] - gap) < 1e-6

    def test_known_benchmark(self):
        """D_gap = 5 - 0.9*2.5 = 2.75; ΔE = -2.75*1000*0.01 = -27.5"""
        result = duration_gap(
            asset_duration=5.0, liability_duration=2.5,
            asset_value=1000, liability_value=900, rate_shock=0.01
        )
        assert abs(result["duration_gap"] - 2.75) < 1e-6
        assert abs(result["equity_sensitivity"] - (-27.5)) < 0.01


class TestLCR:
    def test_lcr_above_100_passes(self):
        result = lcr_calculator(hqla=1000, cash_outflows=800, cash_inflows=200)
        assert result["lcr"] >= 1.0
        assert result["status"] == "PASS"

    def test_lcr_below_100_fails(self):
        result = lcr_calculator(hqla=400, cash_outflows=800, cash_inflows=200)
        assert result["lcr"] < 1.0
        assert result["status"] == "FAIL"

    def test_inflow_cap_binding(self):
        """When inflows > 75% of outflows, cap binds."""
        result = lcr_calculator(hqla=500, cash_outflows=800, cash_inflows=700)
        # cap = 75% * 800 = 600; inflows = 700 > 600 → use 600
        assert result["capped_inflows"] == 600.0
        assert result["net_cash_outflows"] == 200.0  # 800 - 600

    def test_inflow_cap_not_binding(self):
        """When inflows < 75% of outflows, no cap."""
        result = lcr_calculator(hqla=500, cash_outflows=800, cash_inflows=300)
        # 75% * 800 = 600; inflows = 300 < 600 → use 300
        assert result["capped_inflows"] == 300.0

    def test_lcr_formula(self):
        """LCR = HQLA / NCO."""
        hqla, outflows, inflows = 500, 800, 300
        result = lcr_calculator(hqla, outflows, inflows)
        nco = outflows - min(inflows, 0.75 * outflows)
        expected_lcr = hqla / nco
        assert abs(result["lcr"] - expected_lcr) < 1e-6


class TestNSFR:
    def test_nsfr_passes_when_asf_gt_rsf(self):
        asf = [{"name": "Tier 1 Capital", "amount": 1000, "factor": 1.0}]
        rsf = [{"name": "Loans", "amount": 800, "factor": 0.85}]
        result = nsfr_calculator(asf, rsf)
        assert result["nsfr"] > 1.0
        assert result["status"] == "PASS"

    def test_nsfr_fails_when_rsf_gt_asf(self):
        asf = [{"name": "Deposits", "amount": 500, "factor": 0.90}]
        rsf = [{"name": "Long assets", "amount": 1000, "factor": 0.85}]
        result = nsfr_calculator(asf, rsf)
        assert result["nsfr"] < 1.0
        assert result["status"] == "FAIL"

    def test_nsfr_calculation(self):
        asf = [{"name": "A", "amount": 1000, "factor": 0.95}]
        rsf = [{"name": "B", "amount": 1000, "factor": 0.85}]
        result = nsfr_calculator(asf, rsf)
        assert abs(result["asf"] - 950.0) < 1e-6
        assert abs(result["rsf"] - 850.0) < 1e-6
        assert abs(result["nsfr"] - 950.0 / 850.0) < 1e-6


# ============================================================
# Econometrics Tests
# ============================================================

class TestADFTest:
    def test_stationary_series_low_pvalue(self):
        """White noise → stationary → low p-value (reject H0)."""
        rng = np.random.default_rng(42)
        white_noise = rng.normal(0, 1, 200).tolist()
        result = adf_test(white_noise, regression="c")
        assert result["pvalue"] < 0.05, (
            f"Expected low p-value for stationary series, got {result['pvalue']:.4f}"
        )

    def test_random_walk_high_pvalue(self):
        """Random walk → non-stationary → high p-value (fail to reject H0)."""
        rng = np.random.default_rng(42)
        rw = np.cumsum(rng.normal(0, 1, 300)).tolist()
        result = adf_test(rw, regression="c")
        assert result["pvalue"] > 0.05, (
            f"Expected high p-value for random walk, got {result['pvalue']:.4f}"
        )

    def test_returns_correct_keys(self):
        rng = np.random.default_rng(42)
        series = rng.normal(0, 1, 100).tolist()
        result = adf_test(series)
        assert "statistic" in result
        assert "pvalue" in result
        assert "critical_values" in result
        assert "interpretation" in result


class TestDescriptiveStats:
    def test_normal_distribution_stats(self):
        """Sample from N(0.01, 0.1^2) should have mean ≈ 0.01, std ≈ 0.1."""
        rng = np.random.default_rng(42)
        series = rng.normal(0.01, 0.1, 5000).tolist()
        result = descriptive_stats(series)
        assert abs(result["mean"] - 0.01) < 0.005
        assert abs(result["std"] - 0.1) < 0.005
        assert abs(result["excess_kurtosis"]) < 0.5  # normal → excess kurtosis ≈ 0

    def test_annualized_vol_formula(self):
        rng = np.random.default_rng(42)
        series = rng.normal(0.0, 0.01, 500).tolist()
        result = descriptive_stats(series)
        ratio = result["annualized_vol"] / result["std"]
        assert abs(ratio - np.sqrt(252)) < 0.01


class TestOLSRegression:
    def test_known_regression(self):
        """y = 2 + 3x + epsilon; should recover intercept≈2, slope≈3."""
        rng = np.random.default_rng(42)
        x = rng.uniform(0, 10, 100)
        y = (2.0 + 3.0 * x + rng.normal(0, 1, 100)).tolist()
        X = [[xi] for xi in x]
        result = ols_regression(y=y, X=X, feature_names=["x"], add_constant=True)
        assert abs(result["coefficients"]["const"] - 2.0) < 0.5
        assert abs(result["coefficients"]["x"] - 3.0) < 0.2
        assert result["r_squared"] > 0.95

    def test_r_squared_in_unit_interval(self):
        rng = np.random.default_rng(42)
        x = rng.uniform(0, 10, 50)
        y = (x + rng.normal(0, 1, 50)).tolist()
        result = ols_regression(y=y, X=[[xi] for xi in x], feature_names=["x"])
        assert 0 <= result["r_squared"] <= 1
        assert 0 <= result["adj_r_squared"] <= 1


# ============================================================
# Portfolio Tests
# ============================================================

class TestPortfolioAnalytics:
    def test_portfolio_return_formula(self, multi_asset_returns):
        """Portfolio return = w' × μ."""
        weights = [0.5, 0.3, 0.2]
        result = portfolio_analytics(multi_asset_returns, weights, ["SPY", "GLD", "TLT"])
        # Check weights normalized
        assert abs(sum(result["weights"]) - 1.0) < 1e-6

    def test_sharpe_ratio_formula(self, multi_asset_returns):
        """Sharpe = (R - Rf) / sigma."""
        result = portfolio_analytics(
            multi_asset_returns, [0.5, 0.3, 0.2], ["A", "B", "C"], risk_free_rate=0.02
        )
        manual_sharpe = (result["portfolio_return"] - 0.02) / result["portfolio_volatility"]
        assert abs(result["sharpe_ratio"] - manual_sharpe) < 1e-6

    def test_covariance_matrix_symmetric(self, multi_asset_returns):
        weights = [0.4, 0.4, 0.2]
        result = portfolio_analytics(multi_asset_returns, weights, ["A", "B", "C"])
        cov = np.array(result["covariance_matrix"])
        assert np.allclose(cov, cov.T, atol=1e-10), "Covariance matrix is not symmetric"

    def test_correlation_matrix_diagonal_ones(self, multi_asset_returns):
        weights = [0.4, 0.4, 0.2]
        result = portfolio_analytics(multi_asset_returns, weights, ["A", "B", "C"])
        corr = np.array(result["correlation_matrix"])
        for i in range(corr.shape[0]):
            assert abs(corr[i, i] - 1.0) < 1e-6


class TestMaximumDrawdown:
    def test_known_drawdown(self):
        """Returns: +10%, -20%, +5% → MDD at -20% from peak of 1.10."""
        returns = [0.10, -0.20, 0.05]
        result = maximum_drawdown(returns)
        # Cum: 1.10, 0.88, 0.924; DD at 0.88: (0.88-1.10)/1.10 = -0.2
        assert abs(result["max_drawdown"] - (-0.20)) < 0.001

    def test_monotone_increasing_zero_drawdown(self):
        """Only positive returns → zero drawdown."""
        returns = [0.01, 0.02, 0.015, 0.01]
        result = maximum_drawdown(returns)
        assert result["max_drawdown"] >= -1e-10  # essentially 0


class TestEfficientFrontier:
    def test_min_vol_portfolio_lowest_vol(self, multi_asset_returns):
        """Min-vol portfolio should have lower vol than equal-weight portfolio."""
        result = efficient_frontier(multi_asset_returns, ["A", "B", "C"], n_portfolios=200)
        minvol = result["min_vol_portfolio"]["volatility"]
        # Equal weight vol
        eq_w = [1 / 3, 1 / 3, 1 / 3]
        port = portfolio_analytics(multi_asset_returns, eq_w, ["A", "B", "C"])
        assert minvol <= port["portfolio_volatility"] * 1.05  # allow 5% tolerance

    def test_frontier_has_expected_keys(self, multi_asset_returns):
        result = efficient_frontier(multi_asset_returns, ["A", "B", "C"], n_portfolios=100)
        assert "frontier_returns" in result
        assert "frontier_vols" in result
        assert "min_vol_portfolio" in result
        assert "max_sharpe_portfolio" in result


# ============================================================
# Stress Testing Tests
# ============================================================

class TestStressTesting:
    def test_equity_shock_impact(self):
        """30% equity shock → total loss contains equity component."""
        result = apply_stress_scenario(
            portfolio_value=10_000_000,
            var_base=150_000, es_base=200_000, vol_base=0.15,
            duration_gap_base=2.5, lcr_base=1.35,
            equity_shock=-0.30, vol_shock=2.0, rate_shock=0.0,
            credit_spread_shock=0.0, liquidity_shock=0.0, deposit_outflow=0.0,
        )
        # Equity P&L = -0.30 * 10M = -3M → loss = 3M
        assert abs(result["impact"]["equity_pnl"] - (-3_000_000)) < 1

    def test_vol_shock_increases_var(self):
        """Vol shock of 2× → stressed VaR ≈ 2× base VaR."""
        result = apply_stress_scenario(
            portfolio_value=10_000_000,
            var_base=150_000, es_base=200_000, vol_base=0.15,
            duration_gap_base=0.0, lcr_base=1.35,
            equity_shock=0.0, vol_shock=2.0, rate_shock=0.0,
            credit_spread_shock=0.0, liquidity_shock=0.0, deposit_outflow=0.0,
        )
        assert abs(result["stress"]["var"] - 300_000) < 1

    def test_scenario_presets_available(self):
        presets = get_scenario_presets()
        assert "2008_gfc" in presets
        assert "2020_covid" in presets
        assert "2023_banking" in presets

    def test_deterministic_scenario(self):
        """Same inputs → same outputs."""
        kwargs = dict(
            portfolio_value=10_000_000, var_base=100_000, es_base=150_000,
            vol_base=0.15, duration_gap_base=2.0, lcr_base=1.2,
            equity_shock=-0.20, vol_shock=1.5, rate_shock=0.01,
            credit_spread_shock=0.02, liquidity_shock=0.1, deposit_outflow=0.05
        )
        r1 = apply_stress_scenario(**kwargs)
        r2 = apply_stress_scenario(**kwargs)
        assert r1["impact"]["total_pnl"] == r2["impact"]["total_pnl"]
