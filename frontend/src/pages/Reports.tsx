import { useState } from 'react'
import { reportsApi, marketRiskApi, creditRiskApi, almApi, dataApi } from '@/services/api'
import {
  Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, MetricCard
} from '@/components/ui'
import { fmtCurrency } from '@/lib/utils'
import { Download, FileText, RefreshCw } from 'lucide-react'

interface ReportInputs {
  portfolio_name: string
  portfolio_value: number
  var_1d_99: number
  es_1d_99: number
  volatility_annual: number
  sharpe_ratio: number
  max_drawdown: number
  var_limit: number
  total_el: number
  total_ead: number
  weighted_avg_pd: number
  weighted_avg_lgd: number
  lcr: number
  nsfr: number
  duration_gap: number
  equity_sensitivity: number
  stress_scenario_name: string
  stress_total_loss: number
  stress_pct_loss: number
  stress_var_change: number
  stress_lcr_stressed: number
  analyst_notes: string
}

export default function Reports() {
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<{ markdown: string; json_report: Record<string, unknown>; generated_at: string } | null>(null)

  const [inputs, setInputs] = useState<ReportInputs>({
    portfolio_name: 'Reference Portfolio',
    portfolio_value: 10_000_000,
    var_1d_99: 148_230,
    es_1d_99: 201_550,
    volatility_annual: 0.1425,
    sharpe_ratio: 0.82,
    max_drawdown: -0.1234,
    var_limit: 200_000,
    total_el: 56_250,
    total_ead: 10_000_000,
    weighted_avg_pd: 0.025,
    weighted_avg_lgd: 0.42,
    lcr: 1.38,
    nsfr: 1.12,
    duration_gap: 2.75,
    equity_sensitivity: -247_500,
    stress_scenario_name: 'GFC 2008',
    stress_total_loss: 2_100_000,
    stress_pct_loss: 21.0,
    stress_var_change: 525_000,
    stress_lcr_stressed: 0.78,
    analyst_notes: 'Portfolio is within approved risk limits. Duration gap is elevated relative to target. LCR passes minimum requirement with adequate buffer.',
  })

  const update = (key: keyof ReportInputs, val: string | number) =>
    setInputs(prev => ({ ...prev, [key]: val }))

  async function autoPopulate() {
    setAutoLoading(true); setError(null)
    try {
      const spyRes = await dataApi.sample('SPY', 252)
      const returns = spyRes.data.data.returns as number[]

      const [varRes, volRes, elRes, lcrRes, dgRes] = await Promise.all([
        marketRiskApi.parametricVaR({ returns, confidence: 0.99, holding_period: 1, portfolio_value: inputs.portfolio_value }),
        marketRiskApi.volatility({ returns, method: 'ewma', lambda_: 0.94 }),
        creditRiskApi.expectedLoss({
          exposures: [
            { name: 'Corporate', pd: 0.025, lgd: 0.45, ead: 5_000_000 },
            { name: 'SME', pd: 0.04, lgd: 0.55, ead: 2_500_000 },
            { name: 'Retail', pd: 0.01, lgd: 0.30, ead: 2_500_000 },
          ]
        }),
        almApi.lcr({ hqla: 3_500_000, cash_outflows: 4_000_000, cash_inflows: 1_200_000 }),
        almApi.durationGap({ asset_duration: 5.0, liability_duration: 2.5, asset_value: 10_000_000, liability_value: 9_000_000, rate_shock: 0.01 }),
      ])

      const v = varRes.data.data
      const vol = volRes.data.data
      const el = elRes.data.data
      const lcr = lcrRes.data.data
      const dg = dgRes.data.data

      setInputs(prev => ({
        ...prev,
        var_1d_99: Math.round(v.var),
        es_1d_99: Math.round(v.es),
        volatility_annual: parseFloat(vol.volatility_annual.toFixed(4)),
        sharpe_ratio: parseFloat(((v.mu_daily * 252 - 0.02) / vol.volatility_annual).toFixed(3)),
        total_el: Math.round(el.total_el),
        total_ead: el.total_ead,
        weighted_avg_pd: el.weighted_avg_pd,
        weighted_avg_lgd: el.weighted_avg_lgd,
        lcr: parseFloat(lcr.lcr.toFixed(3)),
        duration_gap: parseFloat(dg.duration_gap.toFixed(3)),
        equity_sensitivity: Math.round(dg.equity_sensitivity),
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to auto-populate from calculations')
    } finally {
      setAutoLoading(false)
    }
  }

  async function generateReport() {
    setLoading(true); setError(null); setReport(null)
    try {
      const res = await reportsApi.riskCommittee({
        ...inputs,
        max_drawdown: inputs.max_drawdown < 0 ? inputs.max_drawdown : -Math.abs(inputs.max_drawdown),
      })
      setReport(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Report generation failed')
    } finally {
      setLoading(false)
    }
  }

  function downloadMarkdown() {
    if (!report) return
    const blob = new Blob([report.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `risk-committee-report-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadJSON() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report.json_report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `risk-committee-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const varBreach = inputs.var_1d_99 > inputs.var_limit

  return (
    <div className="space-y-6">
      <SectionHeader title="Risk Committee Report" subtitle="Generate bank-grade risk summary reports from live calculations">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={autoPopulate} disabled={autoLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 inline ${autoLoading ? 'animate-spin' : ''}`} />
            Auto-Populate from Calculations
          </Button>
        </div>
      </SectionHeader>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-2 gap-4">
        {/* Input Form */}
        <div className="space-y-4">
          {/* Portfolio */}
          <Panel title="Portfolio Information">
            <div className="space-y-3">
              <FormField label="Portfolio Name">
                <input type="text" value={inputs.portfolio_name}
                  onChange={e => update('portfolio_name', e.target.value)}
                  className="bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
              </FormField>
              <FormField label="Portfolio Value ($)">
                <Input type="number" value={inputs.portfolio_value} onChange={e => update('portfolio_value', parseFloat(e.target.value))} />
              </FormField>
              <FormField label="VaR Limit ($)">
                <Input type="number" value={inputs.var_limit} onChange={e => update('var_limit', parseFloat(e.target.value))} />
              </FormField>
            </div>
          </Panel>

          {/* Market Risk Inputs */}
          <Panel title="Market Risk Metrics">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'var_1d_99', label: '1-Day 99% VaR ($)' },
                { key: 'es_1d_99', label: '1-Day 99% ES ($)' },
                { key: 'volatility_annual', label: 'Annual Volatility' },
                { key: 'sharpe_ratio', label: 'Sharpe Ratio' },
                { key: 'max_drawdown', label: 'Max Drawdown (negative)' },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.0001" value={inputs[key as keyof ReportInputs] as number}
                    onChange={e => update(key as keyof ReportInputs, parseFloat(e.target.value))} />
                </FormField>
              ))}
            </div>
            {varBreach && <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">⚠️ VaR exceeds limit — will be flagged as BREACH in report</div>}
          </Panel>

          {/* Credit Risk */}
          <Panel title="Credit Risk Metrics">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'total_el', label: 'Expected Loss ($)' },
                { key: 'total_ead', label: 'Total EAD ($)' },
                { key: 'weighted_avg_pd', label: 'Weighted Avg PD' },
                { key: 'weighted_avg_lgd', label: 'Weighted Avg LGD' },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.001" value={inputs[key as keyof ReportInputs] as number}
                    onChange={e => update(key as keyof ReportInputs, parseFloat(e.target.value))} />
                </FormField>
              ))}
            </div>
          </Panel>

          {/* ALM / Liquidity */}
          <Panel title="Liquidity & ALM">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'lcr', label: 'LCR' },
                { key: 'nsfr', label: 'NSFR' },
                { key: 'duration_gap', label: 'Duration Gap (yrs)' },
                { key: 'equity_sensitivity', label: 'Equity Sensitivity ($)' },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.001" value={inputs[key as keyof ReportInputs] as number}
                    onChange={e => update(key as keyof ReportInputs, parseFloat(e.target.value))} />
                </FormField>
              ))}
            </div>
          </Panel>

          {/* Stress Test */}
          <Panel title="Stress Test Results">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Scenario Name">
                <input type="text" value={inputs.stress_scenario_name}
                  onChange={e => update('stress_scenario_name', e.target.value)}
                  className="bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
              </FormField>
              {[
                { key: 'stress_total_loss', label: 'Total Stress Loss ($)' },
                { key: 'stress_pct_loss', label: 'Loss % of Portfolio' },
                { key: 'stress_var_change', label: 'VaR Change ($)' },
                { key: 'stress_lcr_stressed', label: 'Stressed LCR' },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.01" value={inputs[key as keyof ReportInputs] as number}
                    onChange={e => update(key as keyof ReportInputs, parseFloat(e.target.value))} />
                </FormField>
              ))}
            </div>
          </Panel>

          {/* Analyst Notes */}
          <Panel title="Analyst Notes">
            <textarea
              value={inputs.analyst_notes}
              onChange={e => update('analyst_notes', e.target.value)}
              rows={4}
              className="w-full bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              placeholder="Add analyst commentary, limit breaches, escalations..."
            />
          </Panel>

          <Button onClick={generateReport} disabled={loading} size="lg" className="w-full">
            <FileText className="w-4 h-4 mr-2 inline" />
            {loading ? 'Generating Report...' : 'Generate Risk Committee Report'}
          </Button>
        </div>

        {/* Report Preview */}
        <div>
          {loading && <LoadingSpinner message="Generating report..." />}
          {report && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-200">Report Generated</div>
                  <div className="text-xs text-slate-500">{new Date(report.generated_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={downloadMarkdown}>
                    <Download className="w-3 h-3 mr-1 inline" /> Markdown
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadJSON}>
                    <Download className="w-3 h-3 mr-1 inline" /> JSON
                  </Button>
                </div>
              </div>

              {/* Quick metrics from JSON report */}
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="VaR Utilization" value={`${((report.json_report.market_risk as Record<string, number>)?.var_utilization * 100).toFixed(1)}%`}
                  status={(report.json_report.market_risk as Record<string, boolean>)?.var_breach ? 'fail' : 'pass'} />
                <MetricCard label="LCR Status" value={`${((report.json_report.liquidity as Record<string, number>)?.lcr_pct).toFixed(1)}%`}
                  status={(report.json_report.liquidity as Record<string, boolean>)?.lcr_pass ? 'pass' : 'fail'} />
              </div>

              {/* Markdown preview */}
              <Panel title="Report Preview (Markdown)">
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {report.markdown}
                  </pre>
                </div>
              </Panel>
            </div>
          )}

          {!report && !loading && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <FileText className="w-16 h-16 text-slate-700 mb-4" />
              <div className="text-slate-500 text-sm">Fill in the inputs and click Generate to create your Risk Committee Report</div>
              <div className="text-slate-600 text-xs mt-2">Or use Auto-Populate to pull values from live calculations</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
