// @ts-nocheck
import { useState } from 'react'
import { stressApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, DataTable, StatusBadge,
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { useI18n } from '@/i18n'
import Plot from 'react-plotly.js'

const PRESET_KEYS = ['2008_gfc', '2020_covid', '2023_banking', 'flash_crash', 'commodity_shock', 'rate_hike', 'geopolitical'] as const

export default function CrisisSandbox() {
  const { t } = useI18n()
  const cs = t.crisis
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [compResults, setCompResults] = useState<Record<string, unknown>[]>([])
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const [portfolio, setPortfolio] = useState({
    portfolio_value: 10_000_000,
    var_base: 150_000,
    es_base: 200_000,
    vol_base: 0.15,
    duration_gap_base: 2.5,
    lcr_base: 1.35,
  })

  const [shocks, setShocks] = useState({
    equity_shock: -0.20,
    vol_shock: 2.0,
    rate_shock: -0.01,
    credit_spread_shock: 0.02,
    liquidity_shock: 0.15,
    deposit_outflow: 0.05,
  })

  const [presets, setPresets] = useState<Record<string, unknown>>({})

  async function loadPresets() {
    if (Object.keys(presets).length > 0) return presets
    try {
      const res = await stressApi.scenarios()
      const p = res.data.data ?? {}
      setPresets(p)
      return p
    } catch {
      return {}
    }
  }

  async function applyPreset(key: string) {
    const loadedPresets = await loadPresets()
    const p = loadedPresets[key] as any
    if (!p || !p.shocks) return
    setShocks({
      equity_shock: p.shocks.equity_shock as number,
      vol_shock: p.shocks.vol_shock as number,
      rate_shock: p.shocks.rate_shock as number,
      credit_spread_shock: p.shocks.credit_spread_shock as number,
      liquidity_shock: p.shocks.liquidity_shock as number,
      deposit_outflow: p.shocks.deposit_outflow as number,
    })
    setActivePreset(key)
  }

  async function runStress() {
    setLoading(true); setError(null); setResult(null)
    await loadPresets()
    try {
      const res = await stressApi.apply({ ...portfolio, ...shocks, scenario_name: activePreset ?? 'Custom' })
      setResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Stress simulation failed') }
    finally { setLoading(false) }
  }

  async function runComparison() {
    setLoading(true); setError(null); setCompResults([])
    const loadedPresets = await loadPresets()
    try {
      const results = await Promise.all(
        PRESET_KEYS.map(key => {
          const p = loadedPresets[key] as any
          if (!p || !p.shocks) return null
          return stressApi.apply({ ...portfolio, equity_shock: p.shocks.equity_shock as number, vol_shock: p.shocks.vol_shock as number, rate_shock: p.shocks.rate_shock as number, credit_spread_shock: p.shocks.credit_spread_shock as number, liquidity_shock: p.shocks.liquidity_shock as number, deposit_outflow: p.shocks.deposit_outflow as number, scenario_name: (p.name as string) ?? key })
        }).filter(Boolean)
      )
      const mappedResults = results.map(r => r?.data.data ?? {});
      setCompResults(mappedResults);
      // New: Use compare endpoint
      const compareRes = await stressApi.scenarioComparison({ results: mappedResults });
      setResult({ ...result, comparison_summary: compareRes.data.data })

    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Comparison failed') }
    finally { setLoading(false) }
  }

  const impact = result ? (result.impact as Record<string, unknown>) : null

  const shockSliders = [
    { key: 'equity_shock', label: cs.shockFields.equity, min: -0.60, max: 0.20, step: 0.01, fmt: (v: number) => fmtPct(v * 100) },
    { key: 'vol_shock', label: cs.shockFields.volMult, min: 0.5, max: 6.0, step: 0.1, fmt: (v: number) => `×${v.toFixed(1)}` },
    { key: 'rate_shock', label: cs.shockFields.rate, min: -0.05, max: 0.05, step: 0.005, fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
    { key: 'credit_spread_shock', label: cs.shockFields.credit, min: 0, max: 0.10, step: 0.005, fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
    { key: 'liquidity_shock', label: cs.shockFields.liquidity, min: 0, max: 0.60, step: 0.01, fmt: (v: number) => fmtPct(v * 100) },
    { key: 'deposit_outflow', label: cs.shockFields.deposit, min: 0, max: 0.30, step: 0.01, fmt: (v: number) => fmtPct(v * 100) },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={cs.title} subtitle={cs.subtitle} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── Preset Scenarios ────────────────────────────────────────────────── */}
      <Panel title={cs.presetsTitle}>
        <div className="flex flex-wrap gap-2">
          {PRESET_KEYS.map(key => (
            <button
              key={key}
              onClick={async () => { await loadPresets(); applyPreset(key) }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all min-h-[40px] ${activePreset === key ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[#1e2635] border-[#2a3548] text-slate-300 hover:border-emerald-500/40'}`}
            >
              {key === '2008_gfc' ? '📉 GFC 2008' : 
               key === '2020_covid' ? '🦠 COVID 2020' : 
               key === '2023_banking' ? '🏦 Banking 2023' : 
               key === 'flash_crash' ? '🍂 Flash Crash' : 
               key === 'commodity_shock' ? '🛢️ Oil Shock' : 
               key === 'rate_hike' ? '📈 Rate Hike' : 
               key === 'geopolitical' ? '🌍 Geopolitics' : key}
            </button>
          ))}
          {activePreset && (
            <button onClick={() => setActivePreset(null)} className="px-3 py-2 rounded-lg text-xs text-slate-400 border border-[#1e2635] hover:border-red-500/40 min-h-[40px]">
              × {cs.clearBtn}
            </button>
          )}
        </div>
      </Panel>

      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Portfolio inputs */}
        <Panel title={cs.portfolioTitle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(portfolio).map(([key, val]) => (
              <FormField key={key} label={(cs.portfolioFields as Record<string, string>)[key] ?? key}>
                <Input type="number" step="any" value={val}
                  onChange={e => setPortfolio(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} />
              </FormField>
            ))}
          </div>
        </Panel>

        {/* Shock sliders */}
        <Panel title={cs.shocksTitle}>
          <div className="space-y-4">
            {shockSliders.map(({ key, label, min, max, step, fmt }) => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className={`text-xs font-mono font-bold ${key === 'equity_shock' && (shocks as any)[key] < -0.15 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fmt((shocks as any)[key])}
                  </span>
                </div>
                <input type="range" min={min} max={max} step={step} value={(shocks as any)[key]}
                  onChange={e => setShocks(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
                  className="w-full accent-emerald-500" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={runStress} disabled={loading} size="lg">
          {loading ? cs.runningBtn : cs.runBtn}
        </Button>
        <Button variant="secondary" onClick={runComparison} disabled={loading}>
          {cs.compareBtn}
        </Button>
      </div>

      {loading && <LoadingSpinner message={cs.loading} />}

      {/* ── Single Scenario Result ────────────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{cs.resultsTitle} {result.scenario_name as string}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <MetricCard label={cs.totalPnL} value={fmtCurrency(impact!.total_pnl as number)}
              subValue={`${cs.pnlNote}: ${fmtPct((impact!.total_pnl as number) / portfolio.portfolio_value * 100)}`}
              status={(impact!.total_pnl as number) < 0 ? 'fail' : 'pass'} />
            <MetricCard label={cs.varStressed} value={fmtCurrency((result.stress as any).var)}
              subValue={`${cs.varNote}: +${fmtPct((impact!.var_change_pct as number))}`} status="warn" />
            <MetricCard label={cs.volStressed} value={fmtPct((result.stress as any).volatility * 100)}
              subValue={`${cs.absolute}: +${fmtPct((impact!.vol_change as number) * 100)}`} status="warn" />
            <MetricCard label={cs.lcrStressed} value={fmtPct((result.stress as any).lcr * 100)}
              status={(result.stress as any).lcr < 1 ? 'fail' : 'pass'}
              subValue={(result.stress as any).lcr < 1 ? cs.lcrBreach : ''} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title={cs.beforeAfter}>
              <DataTable
                headers={cs.baHeaders}
                rows={[
                  [cs.baRows.value, fmtCurrency((result.base as any).portfolio_value), fmtCurrency((result.stress as any).portfolio_value), fmtCurrency((result.stress as any).portfolio_value - (result.base as any).portfolio_value)],
                  [cs.baRows.var, fmtCurrency((result.base as any).var), fmtCurrency((result.stress as any).var), fmtCurrency(impact!.var_change as number)],
                  [cs.baRows.es, fmtCurrency((result.base as any).es), fmtCurrency((result.stress as any).es), fmtCurrency(impact!.es_change as number)],
                  [cs.baRows.vol, fmtPct((result.base as any).volatility * 100), fmtPct((result.stress as any).volatility * 100), fmtPct((impact!.vol_change as number) * 100)],
                  [cs.baRows.lcr, fmtPct((result.base as any).lcr * 100), fmtPct((result.stress as any).lcr * 100), fmtPct(((result.stress as any).lcr - (result.base as any).lcr) * 100)],
                ]}
              />
            </Panel>

            <Panel title={cs.waterfallTitle}>
              <Plot
                data={[{
                  type: 'waterfall',
                  x: cs.waterfallLabels,
                  y: [
                    impact!.equity_pnl as number,
                    -(((result.stress as any).var) - (result.base as any).var),
                    impact!.rate_impact as number || 0,
                    impact!.credit_spread_impact as number || 0,
                    impact!.liquidity_impact as number || 0,
                    impact!.total_pnl as number,
                  ],
                  measure: ['relative', 'relative', 'relative', 'relative', 'relative', 'total'],
                  connector: { line: { color: '#1e2635' } },
                  increasing: { marker: { color: '#10b981' } },
                  decreasing: { marker: { color: '#ef4444' } },
                  totals: { marker: { color: '#3b82f6' } },
                  textfont: { color: '#94a3b8', size: 9 },
                }]}
                layout={{
                  paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                  font: { color: '#94a3b8', size: 9 },
                  margin: { t: 10, r: 10, b: 50, l: 65 },
                  xaxis: { gridcolor: '#1e2635' },
                  yaxis: { title: cs.pnlImpact, gridcolor: '#1e2635', tickformat: '$,.0f' },
                  height: 250, showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </Panel>
          </div>
        </div>
      )}

      {/* ── Comparison ────────────────────────────────────────────────────── */}
      {compResults.length > 0 && !loading && (
        <Panel title={cs.comparisonTitle}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1e2635]">
                  {cs.compHeaders.map((h, i) => (
                    <th key={i} className="text-left text-slate-500 uppercase pb-2 pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compResults.map((cr, i) => {
                  const imp = (cr.impact as Record<string, unknown>)
                  const str = (cr.stress as Record<string, unknown>)
                  const lcrOk = (str?.lcr as number) >= 1
                  return (
                    <tr key={i} className="border-b border-[#1e2635]/50 last:border-0">
                      <td className="py-2 pr-3 text-slate-300 font-medium">{cr.scenario_name as string}</td>
                      <td className="py-2 pr-3 text-red-400">{fmtPct((cr.shocks_applied as any)?.equity_shock * 100)}</td>
                      <td className="py-2 pr-3 text-red-400">{fmtCurrency(imp?.total_loss as number)}</td>
                      <td className="py-2 pr-3 text-red-400">{fmtPct(imp?.pct_loss as number)}</td>
                      <td className="py-2 pr-3 text-amber-400">{fmtCurrency(str?.var as number)}</td>
                      <td className="py-2 pr-3" style={{ color: lcrOk ? '#10b981' : '#ef4444' }}>{fmtPct((str?.lcr as number) * 100)}</td>
                      <td className="py-2"><StatusBadge status={lcrOk ? 'PASS' : 'FAIL'} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Plot
              data={[{
                x: compResults.map(r => r.scenario_name as string),
                y: compResults.map(r => (r.impact as any)?.pct_loss),
                type: 'bar',
                marker: { color: ['#ef4444', '#f59e0b', '#3b82f6'] },
                text: compResults.map(r => `${fmtPct((r.impact as any)?.pct_loss)}`),
                textposition: 'outside',
                textfont: { color: '#94a3b8', size: 10 },
              }]}
              layout={{
                paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                font: { color: '#94a3b8', size: 10 },
                margin: { t: 20, r: 10, b: 60, l: 50 },
                yaxis: { title: cs.lossLabel, gridcolor: '#1e2635', tickformat: '.1f' },
                height: 220, showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </Panel>
      )}
    </div>
  )
}
