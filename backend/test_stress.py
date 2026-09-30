from app.quant.stress_testing import apply_stress_scenario
try:
    res = apply_stress_scenario(
        portfolio_value=1000000,
        var_base=10000,
        es_base=15000,
        vol_base=0.02,
        duration_gap_base=5,
        lcr_base=1.2,
        equity_shock=-0.2,
        vol_shock=2.0,
        rate_shock=-0.01,
        credit_spread_shock=0.02,
        liquidity_shock=0.15,
        deposit_outflow=0.05
    )
    print(res)
except Exception as e:
    print("ERROR:", e)
