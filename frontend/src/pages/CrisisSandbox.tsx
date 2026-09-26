// @ts-nocheck
import { useState, useEffect } from 'react'
import { stressApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, DataTable, StatusBadge
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Plot from 'react-plotly.js'

interface ScenarioPreset {
  key: string
  name: string
  description: string
  shocks: Record<string, number>
}

interface StressResult {
  scenario_name: string
  base: { portfolio_value: number; var: number; es: number; volatility: number; lcr: number }
  stress: { portfolio_value: number; var: number; es: number; volatility: number; lcr: number }
  impact: {
    equity_pnl: number
    total_pnl: number
    total_loss: number
    pct_loss: number
    var_change: number
    var_change_pct: number
    vol_change: number
    lcr_change: number
    rate_impact?: number
    credit_spread_impact?: number
    liquidity_impact?: number
    deposit_impact?: number
  }
  shocks_applied: Record<string, number>
}

const SHOCK_LABELS: Record<string, string> = {
  equity_shock: 'Equity Shock',
  vol_shock: 'Vol Multiplier',
  rate_shock: 'Rate Shock',
  credit_spread_shock: 'Credit Spread Shock',
  liquidity_shock: 'Liquidity Haircut',
  deposit_outflow: 'Deposit Outflow',
}

export default function CrisisSandbox() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presets, setPresets] = useState<Record<string, ScenarioPreset>>({})
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [result, setResult] = useState<StressResult | null>(null)
  const [comparisonResults, setComparisonResults] = useState<StressResult[]>([])

  // Portfolio inputs
  const [portfolio, setPortfolio] = useState({
    portfolio_value: 10_000_000,
    var_base: 150_000,
    es_base: 210_000,
    vol_base: 0.15,
    duration_gap_base: 2.5,
    lcr_base: 1.35,
  })

  // Custom shocks
  const [shocks, setShocks] = useState({
    equity_shock: -0.20,
    vol_shock: 2.0,
    rate_shock: 0.01,
    credit_spread_shock: 0.02,
    liquidity_shock: 0.15,
    deposit_outflow: 0.05,
    scenario_name: 'Custom Scenario',
  })

  useEffect(() => {
    loadPresets()
  }, [])

  async function loadPresets() {
    try {
      const res = await stressApi.scenarios()
      setPresets(res.data.data)
    } catch { /* ignore */ }
  }

  async function applyPreset(key: string) {
    setSelectedPreset(key)
    const preset = presets[key]
    if (!preset) return
    setShocks({
      equity_shock: preset.shocks.equity_shock,
      vol_shock: preset.shocks.vol_shock,
      rate_shock: preset.shocks.rate_shock,
      credit_spread_shock: preset.shocks.credit_spread_shock,
      liquidity_shock: preset.shocks.liquidity_shock,
      deposit_outflow: preset.shocks.deposit_outflow,
      scenario_name: preset.name,
    })
  }

  async function runStress() {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await stressApi.apply({ ...portfolio, ...shocks })
      setResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  async function runAllPresets() {
    setLoading(true); setError(null); setComparisonResults([])
    try {
      const results = await Promise.all(
        Object.entries(presets).map(([, preset]) =>
          stressApi.apply({
            ...portfolio,
            equity_shock: preset.shocks.equity_shock,
            vol_shock: preset.shocks.vol_shock,
            rate_shock: preset.shocks.rate_shock,
            credit_spread_shock: preset.shocks.credit_spread_shock,
            liquidity_shock: preset.shocks.liquidity_shock,
            deposit_outflow: preset.shocks.deposit_outflow,
            scenario_name: preset.name,
          })
        )
      )
      setComparisonResults(results.map(r => r.data.data))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  const impact = result?.impact
  const isLCRBreach = result ? result.stress.lcr < 1.0 : false

  return (
    <div className="space-y-6">
      <SectionHeader title="Crisis Sandbox" subtitle="Stress Testing — Apply Historical Scenarios or Custom Shocks to Your Portfolio" />

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-3 gap-4">
        {/* Preset Scenarios */}
        <Panel title="Scenario Presets" className="col-span-1">
          <div className="space-y-3">
            {Object.entries(presets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  selectedPreset === key
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-[#1e2635] hover:border-red-500/30 hover:bg-red-500/5'
                )}>
                <div className="text-sm font-medium text-slate-200">{preset.name}</div>
                <div className="text-xs text-slate-500 mt-1">{preset.description}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    ['Equity', `${(preset.shocks.equity_shock * 100).toFixed(0)}%`, preset.shocks.equity_shock < -0.30 ? 'fail' : 'warn'],
                    ['Vol ×', `${preset.shocks.vol_shock}x`, 'warn'],
                    ['Rates', `${(preset.shocks.rate_shock * 100).toFixed(1)}%`, 'neutral'],
                  ].map(([l, v, s]) => (
                    <span key={l as string} className={cn('text-xs px-1.5 py-0.5 rounded border font-mono',
                      s === 'fail' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                      s === 'warn' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' :
                      'border-[#1e2635] text-slate-400')}>
                      {l}: {v}
                    </span>
                  ))}
                </div>
              </button>
            ))}
            <div className="pt-2 border-t border-[#1e2635]">
              <Button variant="secondary" size="sm" className="w-full" onClick={() => { setSelectedPreset(null); setShocks(prev => ({ ...prev, scenario_name: 'Custom Scenario' })) }}>
                Clear — Use Custom Shocks
              </Button>
            </div>
          </div>
        </Panel>

        {/* Portfolio + Shocks Config */}
        <div className="col-span-2 space-y-4">
          {/* Portfolio Inputs */}
          <Panel title="Base Portfolio">
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'portfolio_value', label: 'Portfolio Value ($)' },
                { key: 'var_base', label: '1-Day VaR ($)' },
                { key: 'es_base', label: 'Expected Shortfall ($)' },
                { key: 'vol_base', label: 'Annual Volatility' },
                { key: 'duration_gap_base', label: 'Duration Gap (yrs)' },
                { key: 'lcr_base', label: 'LCR Ratio' },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input
                    type="number"
                    step="0.01"
                    value={portfolio[key as keyof typeof portfolio]}
                    onChange={e => setPortfolio(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  />
                </FormField>
              ))}
            </div>
          </Panel>

          {/* Shock Parameters */}
          <Panel title={`Shock Parameters — ${shocks.scenario_name}`}>
            <div className="grid grid-cols-2 gap-4">
              {/* Equity shock slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-slate-400">Equity Shock</label>
                  <span className={cn('text-xs font-mono font-bold', shocks.equity_shock < -0.25 ? 'text-red-400' : 'text-amber-400')}>
                    {fmtPct(shocks.equity_shock * 100)}
                  </span>
                </div>
                <input type="range" min={-0.60} max={0.20} step={0.01}
                  value={shocks.equity_shock}
                  onChange={e => setShocks(p => ({ ...p, equity_shock: parseFloat(e.target.value), scenario_name: 'Custom' }))}
                  className="w-full accent-red-500" />
              </div>

              {/* Vol shock slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-slate-400">Volatility Multiplier</label>
                  <span className="text-xs font-mono font-bold text-amber-400">{shocks.vol_shock.toFixed(1)}×</span>
                </div>
                <input type="range" min={1.0} max={6.0} step={0.1}
                  value={shocks.vol_shock}
                  onChange={e => setShocks(p => ({ ...p, vol_shock: parseFloat(e.target.value), scenario_name: 'Custom' }))}
                  className="w-full accent-amber-500" />
              </div>

              {/* Rate shock */}
              <FormField label={`Rate Shock: ${(shocks.rate_shock * 10000).toFixed(0)} bps`}>
                <input type="range" min={-0.03} max={0.03} step={0.001}
                  value={shocks.rate_shock}
                  onChange={e => setShocks(p => ({ ...p, rate_shock: parseFloat(e.target.value), scenario_name: 'Custom' }))}
                  className="w-full accent-blue-500" />
              </FormField>

              {/* Credit spread shock */}
              <FormField label={`Credit Spread Shock: ${(shocks.credit_spread_shock * 10000).toFixed(0)} bps`}>
                <input type="range" min={0} max={0.10} step={0.001}
                  value={shocks.credit_spread_shock}
                  onChange={e => setShocks(p => ({ ...p, credit_spread_shock: parseFloat(e.target.value), scenario_name: 'Custom' }))}
                  className="w-full accent-purple-500" />
              </FormField>

              {/* Liquidity shock */}
              <FormField label={`Liquidity Haircut: ${fmtPct(shocks.liquidity_shock * 100)}`}>
                <input type="range" min={0} max={0.50} step={0.01}
                  value={shocks.liquidity_shock}
                  onChange={e => setShocks(p => ({ ...p, liquidity_shock: parseFloat(e.target.value), scenario_name: 'Custom' }))}
                  className="w-full accent-cyan-500" />
              </FormField>

              {/* Deposit outflow */}
              <FormField label={`Deposit Outflow: ${fmtPct(shocks.deposit_outflow * 100)}`}>
                <input type="range" min={0} max={0.25} step={0.005}
                  value={shocks.deposit_outflow}
                  onChange={e => setShocks(p => ({ ...p, deposit_outflow: parseFloat(e.target.value), scenario_name: 'Custom' }))}
                  className="w-full accent-orange-500" />
              </FormField>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={runStress} disabled={loading} className="flex-1">
                {loading ? 'Simulating...' : '⚡ Apply Stress Scenario'}
              </Button>
              <Button onClick={runAllPresets} disabled={loading} variant="secondary" className="flex-1">
                Compare All Presets
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      {loading && <LoadingSpinner message="Running stress simulation..." />}

      {/* Single Result */}
      {result && !loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-100">📊 Results: {result.scenario_name}</h3>
            {isLCRBreach && <StatusBadge status="FAIL" label="LCR BREACH" />}
          </div>

          {/* Impact grid */}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Total P&L Impact" value={fmtCurrency(impact!.total_pnl)}
              subValue={fmtPct(impact!.pct_loss) + ' of portfolio'}
              status={Math.abs(impact!.pct_loss) > 20 ? 'fail' : Math.abs(impact!.pct_loss) > 10 ? 'warn' : 'neutral'} />
            <MetricCard label="VaR (Stressed)" value={fmtCurrency(result.stress.var)}
              subValue={`+${fmtPct(impact!.var_change_pct)} vs base`}
              status="fail" />
            <MetricCard label="Vol (Stressed)" value={fmtPct(result.stress.volatility * 100)}
              subValue={`${impact!.vol_change > 0 ? '+' : ''}${fmtPct(impact!.vol_change * 100)} absolute`} />
            <MetricCard label="LCR (Stressed)" value={fmtPct(result.stress.lcr * 100)}
              subValue={`Δ ${(impact!.lcr_change).toFixed(3)}`}
              status={result.stress.lcr >= 1 ? 'pass' : 'fail'} />
          </div>

          {/* Before vs After table */}
          <div className="grid grid-cols-2 gap-4">
            <Panel title="Before vs. After Stress">
              <DataTable
                headers={['Metric', 'Base', 'Stressed', 'Change']}
                rows={[
                  ['Portfolio Value', fmtCurrency(result.base.portfolio_value), fmtCurrency(result.stress.portfolio_value), fmtCurrency(result.stress.portfolio_value - result.base.portfolio_value)],
                  ['VaR (1-day)', fmtCurrency(result.base.var), fmtCurrency(result.stress.var), fmtCurrency(result.stress.var - result.base.var)],
                  ['ES (1-day)', fmtCurrency(result.base.es), fmtCurrency(result.stress.es), fmtCurrency(result.stress.es - result.base.es)],
                  ['Annual Vol', fmtPct(result.base.volatility * 100), fmtPct(result.stress.volatility * 100), fmtPct((result.stress.volatility - result.base.volatility) * 100)],
                  ['LCR', fmtPct(result.base.lcr * 100), fmtPct(result.stress.lcr * 100), `${(result.stress.lcr - result.base.lcr).toFixed(3)}`],
                ]}
              />
            </Panel>

            {/* P&L waterfall chart */}
            <Panel title="P&L Impact Waterfall">
              <Plot
                data={[{
                  type: 'waterfall',
                  x: ['Equity\nShock', 'Vol\nImpact', 'Rate\nImpact', 'Credit\nSpread', 'Liquidity', 'Total'],
                  y: [
                    impact!.equity_pnl,
                    -(result.stress.var - result.base.var),
                    impact!.rate_impact || 0,
                    impact!.credit_spread_impact || 0,
                    impact!.liquidity_impact || 0,
                    impact!.total_pnl,
                  ],
                  measure: ['relative', 'relative', 'relative', 'relative', 'relative', 'total'],
                  connector: { line: { color: '#1e2635' } },
                  increasing: { marker: { color: '#10b981' } },
                  decreasing: { marker: { color: '#ef4444' } },
                  totals: { marker: { color: '#3b82f6' } },
                  text: [
                    fmtCurrency(impact!.equity_pnl),
                    fmtCurrency(-(result.stress.var - result.base.var)),
                    fmtCurrency(impact!.rate_impact || 0),
                    fmtCurrency(impact!.credit_spread_impact || 0),
                    fmtCurrency(impact!.liquidity_impact || 0),
                    fmtCurrency(impact!.total_pnl),
                  ],
                  textfont: { color: '#94a3b8', size: 10 },
                }]}
                layout={{
                  paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                  font: { color: '#94a3b8', size: 11 },
                  margin: { t: 10, r: 10, b: 50, l: 70 },
                  xaxis: { gridcolor: '#1e2635' },
                  yaxis: { title: 'P&L Impact ($)', gridcolor: '#1e2635', tickformat: '$,.0f' },
                  height: 260, showlegend: false,
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Panel>
          </div>
        </div>
      )}

      {/* Multi-scenario comparison */}
      {comparisonResults.length > 0 && !loading && (
        <Panel title="Scenario Comparison">
          <DataTable
            headers={['Scenario', 'Equity Shock', 'Total Loss', 'Loss %', 'Stressed VaR', 'Stressed LCR', 'LCR Status']}
            rows={comparisonResults.map(r => [
              r.scenario_name,
              fmtPct((r.shocks_applied.equity_shock ?? 0) * 100),
              fmtCurrency(r.impact.total_loss),
              fmtPct(Math.abs(r.impact.pct_loss)),
              fmtCurrency(r.stress.var),
              fmtPct(r.stress.lcr * 100),
              <StatusBadge status={r.stress.lcr >= 1 ? 'PASS' : 'FAIL'} />,
            ])}
          />
          {/* Comparison bar chart */}
          <div className="mt-4">
            <Plot
              data={[
                {
                  x: comparisonResults.map(r => r.scenario_name),
                  y: comparisonResults.map(r => Math.abs(r.impact.pct_loss)),
                  type: 'bar',
                  name: 'Loss %',
                  marker: { color: '#ef4444' },
                  text: comparisonResults.map(r => fmtPct(Math.abs(r.impact.pct_loss))),
                  textposition: 'outside',
                },
              ]}
              layout={{
                paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                font: { color: '#94a3b8', size: 11 },
                margin: { t: 20, r: 20, b: 50, l: 50 },
                xaxis: { gridcolor: '#1e2635' },
                yaxis: { title: 'Portfolio Loss %', gridcolor: '#1e2635' },
                height: 240, showlegend: false,
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </div>
        </Panel>
      )}
    </div>
  )
}
