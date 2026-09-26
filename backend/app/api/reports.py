"""QuantRisk OS - Reports API Router

Generates Bank Risk Committee Summary reports from calculation inputs.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import json

router = APIRouter(prefix="/api/reports", tags=["Reports"])


class RiskCommitteeReportRequest(BaseModel):
    # Portfolio
    portfolio_name: str = Field("Default Portfolio", description="Portfolio name")
    portfolio_value: float = Field(..., gt=0)

    # Market Risk
    var_1d_99: float = Field(..., gt=0, description="1-day 99% VaR")
    es_1d_99: float = Field(..., gt=0, description="1-day 99% Expected Shortfall")
    volatility_annual: float = Field(..., gt=0, description="Annual portfolio volatility")
    sharpe_ratio: float = Field(..., description="Portfolio Sharpe ratio")
    max_drawdown: float = Field(..., description="Maximum drawdown (negative)")
    var_limit: float = Field(..., gt=0, description="VaR limit")

    # Credit Risk
    total_el: float = Field(..., ge=0, description="Total Expected Loss")
    total_ead: float = Field(..., gt=0, description="Total Exposure at Default")
    weighted_avg_pd: float = Field(..., ge=0, le=1)
    weighted_avg_lgd: float = Field(..., ge=0, le=1)

    # ALM / Liquidity
    lcr: float = Field(..., gt=0, description="LCR ratio")
    nsfr: Optional[float] = Field(None, description="NSFR ratio")
    duration_gap: float = Field(0.0, description="Duration gap (years)")
    equity_sensitivity: Optional[float] = Field(None)

    # Stress Test
    stress_scenario_name: Optional[str] = None
    stress_total_loss: Optional[float] = None
    stress_pct_loss: Optional[float] = None
    stress_var_change: Optional[float] = None
    stress_lcr_stressed: Optional[float] = None

    # Additional context
    reporting_date: Optional[str] = None
    analyst_notes: Optional[str] = None


def _format_currency(v: float) -> str:
    if abs(v) >= 1_000_000:
        return f"${v/1_000_000:.2f}M"
    elif abs(v) >= 1_000:
        return f"${v/1_000:.1f}K"
    return f"${v:.2f}"


def _status_badge(condition: bool, pass_text: str = "PASS", fail_text: str = "BREACH") -> str:
    return f"✅ {pass_text}" if condition else f"🔴 {fail_text}"


def _generate_markdown_report(data: RiskCommitteeReportRequest) -> str:
    rpt_date = data.reporting_date or datetime.utcnow().strftime("%Y-%m-%d")
    var_breach = data.var_1d_99 > data.var_limit
    lcr_pass = data.lcr >= 1.0
    nsfr_pass = (data.nsfr or 1.0) >= 1.0
    el_pct = data.total_el / data.total_ead * 100 if data.total_ead > 0 else 0

    lines = [
        f"# Bank Risk Committee Summary Report",
        f"**Portfolio:** {data.portfolio_name}  ",
        f"**Report Date:** {rpt_date}  ",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "---",
        "",
        "## 1. Portfolio Overview",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Portfolio Value | {_format_currency(data.portfolio_value)} |",
        f"| Annual Volatility | {data.volatility_annual * 100:.2f}% |",
        f"| Sharpe Ratio | {data.sharpe_ratio:.3f} |",
        f"| Maximum Drawdown | {data.max_drawdown * 100:.2f}% |",
        "",
        "---",
        "",
        "## 2. Market Risk",
        "",
        f"| Metric | Value | Status |",
        f"|--------|-------|--------|",
        f"| 1-Day 99% VaR | {_format_currency(data.var_1d_99)} | {_status_badge(not var_breach, 'WITHIN LIMIT', 'LIMIT BREACH')} |",
        f"| VaR Limit | {_format_currency(data.var_limit)} | — |",
        f"| 1-Day 99% ES (CVaR) | {_format_currency(data.es_1d_99)} | — |",
        f"| VaR Utilization | {data.var_1d_99 / data.var_limit * 100:.1f}% | — |",
        "",
        ("⚠️ **LIMIT BREACH**: VaR exceeds the approved limit. "
         "Escalation required per trading limit policy.\n" if var_breach else ""),
        "---",
        "",
        "## 3. Credit Risk",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Exposure at Default | {_format_currency(data.total_ead)} |",
        f"| Expected Loss (EL) | {_format_currency(data.total_el)} |",
        f"| EL as % of EAD | {el_pct:.3f}% |",
        f"| Weighted Average PD | {data.weighted_avg_pd * 100:.3f}% |",
        f"| Weighted Average LGD | {data.weighted_avg_lgd * 100:.1f}% |",
        "",
        "---",
        "",
        "## 4. Liquidity Risk",
        "",
        f"| Metric | Value | Status |",
        f"|--------|-------|--------|",
        f"| LCR | {data.lcr * 100:.1f}% | {_status_badge(lcr_pass)} |",
    ]

    if data.nsfr is not None:
        lines.append(f"| NSFR | {data.nsfr * 100:.1f}% | {_status_badge(nsfr_pass)} |")

    lines += [
        "",
        "---",
        "",
        "## 5. IRRBB / ALM",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Duration Gap | {data.duration_gap:.2f} years |",
    ]

    if data.equity_sensitivity is not None:
        lines.append(
            f"| Equity Sensitivity (100bps) | {_format_currency(data.equity_sensitivity)} |"
        )

    lines += ["", "---", ""]

    if data.stress_scenario_name:
        lines += [
            "## 6. Stress Test Results",
            "",
            f"**Scenario:** {data.stress_scenario_name}",
            "",
            f"| Impact Metric | Value |",
            f"|--------------|-------|",
        ]
        if data.stress_total_loss is not None:
            lines.append(f"| Total Stress Loss | {_format_currency(data.stress_total_loss)} |")
        if data.stress_pct_loss is not None:
            lines.append(f"| Loss as % of Portfolio | {data.stress_pct_loss:.2f}% |")
        if data.stress_var_change is not None:
            lines.append(f"| VaR Change Under Stress | {_format_currency(data.stress_var_change)} |")
        if data.stress_lcr_stressed is not None:
            lines.append(f"| Stressed LCR | {data.stress_lcr_stressed * 100:.1f}% |")
        lines += ["", "---", ""]

    lines += [
        "## 7. Key Risk Observations",
        "",
        f"- Portfolio VaR utilization: **{data.var_1d_99 / data.var_limit * 100:.1f}%** of limit",
        f"- Expected credit loss represents **{el_pct:.3f}%** of gross exposure",
        f"- Duration gap of **{data.duration_gap:.2f} years** indicates "
        + ("asset-sensitive profile (equity falls if rates rise)" if data.duration_gap > 0 else "liability-sensitive profile"),
        f"- LCR is **{'above' if lcr_pass else 'BELOW'}** the 100% minimum regulatory threshold",
    ]

    if data.analyst_notes:
        lines += ["", "---", "", "## 8. Analyst Notes", "", data.analyst_notes]

    lines += [
        "",
        "---",
        "",
        "## Model Assumptions",
        "",
        "- VaR computed under parametric normal distribution assumption",
        "- Holding period scaling: √h rule applied to daily volatility",
        "- Duration gap uses linear (first-order) approximation; ignores convexity",
        "- LCR computed per Basel III standard with 75% inflow cap",
        "- Expected Loss = PD × LGD × EAD (unconditional, point-in-time)",
        "- Stress scenarios are template shocks, not reproductions of historical events",
        "",
        "*This report is system-generated. Verify all inputs independently.*",
    ]

    return "\n".join(lines)


@router.post("/risk-committee")
async def generate_risk_committee_report(req: RiskCommitteeReportRequest):
    """Generate a Bank Risk Committee Summary report."""
    try:
        markdown = _generate_markdown_report(req)

        json_report = {
            "metadata": {
                "portfolio_name": req.portfolio_name,
                "reporting_date": req.reporting_date or datetime.utcnow().strftime("%Y-%m-%d"),
                "generated_at": datetime.utcnow().isoformat(),
            },
            "market_risk": {
                "portfolio_value": req.portfolio_value,
                "var_1d_99": req.var_1d_99,
                "es_1d_99": req.es_1d_99,
                "volatility_annual": req.volatility_annual,
                "sharpe_ratio": req.sharpe_ratio,
                "max_drawdown": req.max_drawdown,
                "var_limit": req.var_limit,
                "var_breach": req.var_1d_99 > req.var_limit,
                "var_utilization": req.var_1d_99 / req.var_limit,
            },
            "credit_risk": {
                "total_el": req.total_el,
                "total_ead": req.total_ead,
                "el_pct_of_ead": req.total_el / req.total_ead * 100 if req.total_ead > 0 else 0,
                "weighted_avg_pd": req.weighted_avg_pd,
                "weighted_avg_lgd": req.weighted_avg_lgd,
            },
            "liquidity": {
                "lcr": req.lcr,
                "lcr_pct": req.lcr * 100,
                "lcr_pass": req.lcr >= 1.0,
                "nsfr": req.nsfr,
                "nsfr_pct": (req.nsfr * 100) if req.nsfr else None,
                "nsfr_pass": (req.nsfr or 1.0) >= 1.0,
            },
            "alm": {
                "duration_gap": req.duration_gap,
                "equity_sensitivity": req.equity_sensitivity,
            },
            "stress_test": {
                "scenario_name": req.stress_scenario_name,
                "total_loss": req.stress_total_loss,
                "pct_loss": req.stress_pct_loss,
                "var_change": req.stress_var_change,
                "lcr_stressed": req.stress_lcr_stressed,
            } if req.stress_scenario_name else None,
        }

        return {
            "status": "success",
            "data": {
                "markdown": markdown,
                "json_report": json_report,
                "generated_at": datetime.utcnow().isoformat(),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")
