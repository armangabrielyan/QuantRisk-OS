// @ts-nocheck
import { useState } from 'react'
import { portfolioApi, dataApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, DataTable, Tabs,
} from '@/components/ui'
import { fmtPct } from '@/lib/utils'
import { useI18n } from '@/i18n'
import Plot from 'react-plotly.js'

type Tab = 'analytics' | 'frontier' | 'blackLitterman' | 'riskParity' | 'concentration'

interface Asset { id: number; ticker: string; weight: number }

const DEFAULT_ASSETS: Asset[] = [
  { id: 1, ticker: 'SPY', weight: 0.40 },
  { id: 2, ticker: 'GLD', weight: 0.20 },
  { id: 3, ticker: 'TLT', weight: 0.20 },
  { id: 4, ticker: 'JPM', weight: 0.20 },
]

export default function Portfolio() {
  const { t } = useI18n()
  const po = t.portfolio
  const [activeTab, setActiveTab] = useState<Tab>('analytics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS)
  const [rfRate, setRfRate] = useState(0.02)
  const [analyticsResult, setAnalyticsResult] = useState<Record<string, unknown> | null>(null)
  const [frontierResult, setFrontierResult] = useState<Record<string, unknown> | null>(null)

  const [blPriorReturns, setBlPriorReturns] = useState('0.05, 0.06, 0.08, 0.04')
  const [blMarketWeights, setBlMarketWeights] = useState('0.4, 0.2, 0.2, 0.2')
  const [blViewsStr, setBlViewsStr] = useState('[{"P": [0,0,1,-1], "Q": 0.02}]')
  const [blTau, setBlTau] = useState(0.05)
  const [blResult, setBlResult] = useState<Record<string, unknown> | null>(null)

  const [rpCovMatrix, setRpCovMatrix] = useState('[[0.04, 0.01, 0.02, 0], [0.01, 0.05, 0, 0], [0.02, 0, 0.06, 0], [0, 0, 0, 0.03]]')
  const [rpResult, setRpResult] = useState<Record<string, unknown> | null>(null)

  const [concWeights, setConcWeights] = useState('0.4, 0.2, 0.2, 0.2')
  const [concResult, setConcResult] = useState<Record<string, unknown> | null>(null)


  const updateAsset = (id: number, field: keyof Asset, val: string) =>
    setAssets(p => p.map(a => a.id === id ? { ...a, [field]: field === 'ticker' ? val : parseFloat(val) || 0 } : a))
  const addAsset = () => setAssets(p => [...p, { id: Date.now(), ticker: 'QQQ', weight: 0 }])
  const removeAsset = (id: number) => setAssets(p => p.filter(a => a.id !== id))
  const normalizeWeights = () => {
    const total = assets.reduce((s, a) => s + a.weight, 0)
    if (total > 0) setAssets(p => p.map(a => ({ ...a, weight: parseFloat((a.weight / total).toFixed(4)) })))
  }

  async function getReturns(): Promise<{ matrix: number[][]; names: string[] }> {
    const results = await Promise.all(assets.map(a => dataApi.sample(a.ticker, 252)))
    return {
      matrix: results.map(r => r.data.data.returns),
      names: assets.map(a => a.ticker),
    }
  }

  async function runAnalytics() {
    setLoading(true); setError(null); setAnalyticsResult(null)
    try {
      const { matrix, names } = await getReturns()
      const weights = assets.map(a => a.weight)
      const res = await portfolioApi.analytics({ returns_matrix: matrix, weights, asset_names: names, risk_free_rate: rfRate })
      setAnalyticsResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runFrontier() {
    setLoading(true); setError(null); setFrontierResult(null)
    try {
      const { matrix, names } = await getReturns()
      const res = await portfolioApi.efficientFrontier({ returns_matrix: matrix, asset_names: names, n_portfolios: 500, risk_free_rate: rfRate })
      setFrontierResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runBlackLitterman() {
    setLoading(true); setError(null); setBlResult(null)
    try {
      const cov = Array(4).fill(0).map((_, i) => Array(4).fill(0).map((_, j) => i === j ? 0.04 : 0.01))
      const viewsJson = JSON.parse(blViewsStr)
      const res = await portfolioApi.blackLitterman({
        returns: blPriorReturns.split(',').map(Number),
        cov_matrix: cov,
        market_weights: blMarketWeights.split(',').map(Number),
        views: viewsJson.map((v:any) => v.Q),
        p_matrix: viewsJson.map((v:any) => v.P),
        tau: blTau
      })
      setBlResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runRiskParity() {
    setLoading(true); setError(null); setRpResult(null)
    try {
      const res = await portfolioApi.riskParity({
        cov_matrix: JSON.parse(rpCovMatrix)
      })
      setRpResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runConcentration() {
    setLoading(true); setError(null); setConcResult(null)
    try {
      const res = await portfolioApi.concentration({
        weights: concWeights.split(',').map(Number)
      })
      setConcResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  const tabs = [
    { key: 'analytics', label: po.tabs.analytics },
    { key: 'frontier', label: po.tabs.frontier },
    { key: 'blackLitterman', label: t.newFeatures.blackLitterman },
    { key: 'riskParity', label: t.newFeatures.riskParity },
    { key: 'concentration', label: t.newFeatures.concentration },
  ]

  const weightTotal = assets.reduce((s, a) => s + a.weight, 0)
  const weightOk = Math.abs(weightTotal - 1.0) < 0.01

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={po.title} subtitle={po.subtitle} />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── Shared: Portfolio composition ─────────────────────────────────── */}
      <Panel title={po.composition}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[300px]">
            <thead>
              <tr className="border-b border-[#1e2635]">
                <th className="text-left text-xs text-slate-500 uppercase pb-2 pr-3">{po.colAsset}</th>
                <th className="text-left text-xs text-slate-500 uppercase pb-2 pr-3">{po.colWeight}</th>
                <th className="text-left text-xs text-slate-500 uppercase pb-2 pr-3">{po.colPct}</th>
                <th className="text-left text-xs text-slate-500 uppercase pb-2">{po.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className="border-b border-[#1e2635]/50">
                  <td className="py-2 pr-3">
                    <input value={a.ticker} onChange={e => updateAsset(a.id, 'ticker', e.target.value.toUpperCase())}
                      className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-20 uppercase" maxLength={6} />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" step="0.01" min="0" max="1" value={a.weight}
                      onChange={e => updateAsset(a.id, 'weight', e.target.value)}
                      className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-24" />
                  </td>
                  <td className="py-2 pr-3 text-slate-400 text-xs">{fmtPct(a.weight * 100)}</td>
                  <td className="py-2">
                    <button onClick={() => removeAsset(a.id)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={addAsset}>{po.addAsset}</Button>
          <Button variant="secondary" size="sm" onClick={normalizeWeights}>{t.common.normalize}</Button>
          <span className={`text-xs ${weightOk ? 'text-emerald-400' : 'text-red-400'}`}>
            Σ = {weightTotal.toFixed(4)} {!weightOk && '(≠ 1.0)'}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">{po.rfRate}</span>
            <input type="number" step="0.005" min="0" max="0.20" value={rfRate}
              onChange={e => setRfRate(parseFloat(e.target.value))}
              className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-20" />
          </div>
        </div>
      </Panel>

      {/* ── Analytics Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <Button onClick={runAnalytics} disabled={loading || !weightOk} className="w-full sm:w-auto">
            {loading ? po.runningAnalytics : po.runAnalytics}
          </Button>
          {loading && <LoadingSpinner message={po.loading} />}
          {analyticsResult && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                <MetricCard label={po.annualReturn} value={fmtPct((analyticsResult.portfolio_return as number) * 100)} status={(analyticsResult.portfolio_return as number) > 0 ? 'pass' : 'fail'} />
                <MetricCard label={po.annualVol} value={fmtPct((analyticsResult.portfolio_volatility as number) * 100)} />
                <MetricCard label={po.sharpe} value={(analyticsResult.sharpe_ratio as number).toFixed(3)} status={(analyticsResult.sharpe_ratio as number) > 0.5 ? 'pass' : 'warn'} />
                <MetricCard label={po.sortino} value={(analyticsResult.sortino_ratio as number).toFixed(3)} />
                <MetricCard label={po.maxDrawdown} value={fmtPct((analyticsResult.max_drawdown as number) * 100)} status={(analyticsResult.max_drawdown as number) < 0.10 ? 'pass' : 'warn'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title={po.assetBreakdown}>
                  <DataTable
                    headers={po.breakdownHeaders}
                    rows={(analyticsResult.asset_names as string[]).map((name: string, i: number) => [
                      name,
                      fmtPct((assets.find(a => a.ticker === name)?.weight ?? 0) * 100),
                      fmtPct((analyticsResult.asset_returns as number[])[i] * 100),
                      fmtPct((analyticsResult.asset_volatilities as number[])[i] * 100),
                      fmtPct((assets.find(a => a.ticker === name)?.weight ?? 0) * (analyticsResult.asset_volatilities as number[])[i] * 100),
                    ])}
                  />
                </Panel>

                <Panel title={po.correlationMatrix}>
                  {analyticsResult.correlation_matrix && (
                    <Plot
                      data={[{
                        z: analyticsResult.correlation_matrix,
                        x: analyticsResult.asset_names,
                        y: analyticsResult.asset_names,
                        type: 'heatmap',
                        colorscale: [[0, '#ef4444'], [0.5, '#1e2635'], [1, '#10b981']],
                        zmin: -1, zmax: 1,
                        text: (analyticsResult.correlation_matrix as number[][]).map(row => row.map(v => v.toFixed(2))),
                        texttemplate: '%{text}',
                        showscale: false,
                      }]}
                      layout={{
                        paper_bgcolor: '#0f1117', plot_bgcolor: '#161b27',
                        font: { color: '#94a3b8', size: 10 },
                        margin: { t: 10, r: 10, b: 40, l: 55 },
                        height: 220,
                        xaxis: { gridcolor: '#1e2635' },
                        yaxis: { gridcolor: '#1e2635' },
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
                  )}
                </Panel>
              </div>

              {analyticsResult.drawdown_series && (
                <Panel title={po.drawdownChart}>
                  <Plot
                    data={[{
                      x: Array.from({ length: (analyticsResult.drawdown_series as number[]).length }, (_, i) => i),
                      y: (analyticsResult.drawdown_series as number[]).map(d => -(d * 100)),
                      type: 'scatter', mode: 'lines',
                      fill: 'tozeroy', fillcolor: 'rgba(239,68,68,0.15)',
                      line: { color: '#ef4444', width: 1.5 },
                      name: po.drawdownChart,
                    }]}
                    layout={{
                      paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                      font: { color: '#94a3b8', size: 10 },
                      margin: { t: 10, r: 10, b: 40, l: 50 },
                      xaxis: { title: po.days, gridcolor: '#1e2635' },
                      yaxis: { title: po.drawdownPct, gridcolor: '#1e2635', tickformat: '.1f' },
                      height: 220, showlegend: false,
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </Panel>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Efficient Frontier Tab ────────────────────────────────────────── */}
      {activeTab === 'frontier' && (
        <div className="space-y-4">
          <Button onClick={runFrontier} disabled={loading} className="w-full sm:w-auto">
            {loading ? po.runningFrontier : po.runFrontier}
          </Button>
          {loading && <LoadingSpinner message={po.loadingFrontier} />}
          {frontierResult && !loading && (
            <div className="space-y-4">
              <Panel title={po.frontierTitle}>
                <Plot
                  data={[
                    {
                      x: (frontierResult.frontier_vols as number[]).map(v => v * 100),
                      y: (frontierResult.frontier_returns as number[]).map(r => r * 100),
                      mode: 'markers',
                      type: 'scatter',
                      marker: {
                        color: frontierResult.frontier_sharpes as number[],
                        colorscale: 'Viridis', size: 4, opacity: 0.7,
                        colorbar: { title: 'Sharpe', titlefont: { color: '#94a3b8' }, tickfont: { color: '#94a3b8' } },
                      },
                      name: po.frontierPort,
                    },
                    {
                      x: [(frontierResult.min_vol_portfolio as any).volatility * 100],
                      y: [(frontierResult.min_vol_portfolio as any).return * 100],
                      mode: 'markers+text',
                      type: 'scatter',
                      marker: { color: '#10b981', size: 12, symbol: 'star' },
                      text: [po.minVol], textposition: 'top center',
                      textfont: { color: '#10b981', size: 10 },
                      name: po.minVolTitle,
                    },
                    {
                      x: [(frontierResult.max_sharpe_portfolio as any).volatility * 100],
                      y: [(frontierResult.max_sharpe_portfolio as any).return * 100],
                      mode: 'markers+text',
                      type: 'scatter',
                      marker: { color: '#f59e0b', size: 12, symbol: 'star' },
                      text: [po.maxSharpe], textposition: 'top center',
                      textfont: { color: '#f59e0b', size: 10 },
                      name: po.maxSharpeTitle,
                    },
                    {
                      x: (frontierResult.asset_vols as number[]).map(v => v * 100),
                      y: (frontierResult.asset_returns as number[]).map(r => r * 100),
                      mode: 'markers+text',
                      type: 'scatter',
                      marker: { color: '#ef4444', size: 10, symbol: 'diamond' },
                      text: frontierResult.asset_names as string[],
                      textposition: 'top center',
                      textfont: { color: '#ef4444', size: 10 },
                      name: po.assets,
                    },
                  ]}
                  layout={{
                    paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                    font: { color: '#94a3b8', size: 10 },
                    margin: { t: 20, r: 10, b: 50, l: 55 },
                    xaxis: { title: po.annVolPct, gridcolor: '#1e2635' },
                    yaxis: { title: po.annRetPct, gridcolor: '#1e2635' },
                    height: 380,
                    legend: { bgcolor: '#161b27', bordercolor: '#1e2635', font: { size: 10, color: '#94a3b8' } },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </Panel>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Panel title={po.minVolTitle}>
                  <DataTable
                    headers={po.assetHeaders}
                    rows={[
                      [po.metricVol, fmtPct((frontierResult.min_vol_portfolio as any).volatility * 100), ''],
                      [po.metricAnnReturn, fmtPct((frontierResult.min_vol_portfolio as any).return * 100), ''],
                      [po.metricSharpe, (frontierResult.min_vol_portfolio as any).sharpe?.toFixed(3), ''],
                    ].map(([k, v]) => [k, v])}
                  />
                </Panel>
                <Panel title={po.maxSharpeTitle}>
                  <DataTable
                    headers={po.assetHeaders}
                    rows={[
                      [po.metricVol, fmtPct((frontierResult.max_sharpe_portfolio as any).volatility * 100), ''],
                      [po.metricAnnReturn, fmtPct((frontierResult.max_sharpe_portfolio as any).return * 100), ''],
                      [po.metricSharpe, (frontierResult.max_sharpe_portfolio as any).sharpe?.toFixed(3), ''],
                    ].map(([k, v]) => [k, v])}
                  />
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Black-Litterman ─────────────────────────────────────────────── */}
      {activeTab === 'blackLitterman' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.priorReturns}>
                <Input value={blPriorReturns} onChange={e => setBlPriorReturns(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.marketWeights}>
                <Input value={blMarketWeights} onChange={e => setBlMarketWeights(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.views} hint="JSON array of objects with P and Q">
                <Input value={blViewsStr} onChange={e => setBlViewsStr(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.tau}>
                <Input type="number" step="0.01" value={blTau} onChange={e => setBlTau(parseFloat(e.target.value))} />
              </FormField>
              <Button onClick={runBlackLitterman} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {blResult && !loading && (
              <Panel title={t.newFeatures.blReturns}>
                <pre className="text-xs text-slate-300 bg-[#0a0a0f] p-4 rounded overflow-auto">
                  {JSON.stringify(blResult.bl_returns, null, 2)}
                </pre>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ── Risk Parity ─────────────────────────────────────────────────── */}
      {activeTab === 'riskParity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label="Covariance Matrix (JSON 2D array)">
                <Input value={rpCovMatrix} onChange={e => setRpCovMatrix(e.target.value)} />
              </FormField>
              <Button onClick={runRiskParity} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {rpResult && !loading && (
              <Panel title={t.newFeatures.ercWeights}>
                <pre className="text-xs text-slate-300 bg-[#0a0a0f] p-4 rounded overflow-auto">
                  {JSON.stringify(rpResult.weights, null, 2)}
                </pre>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ── Concentration ───────────────────────────────────────────────── */}
      {activeTab === 'concentration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.weights}>
                <Input value={concWeights} onChange={e => setConcWeights(e.target.value)} />
              </FormField>
              <Button onClick={runConcentration} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {concResult && !loading && (
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label={t.newFeatures.hhi} value={(concResult.hhi as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.interpretation} value={concResult.interpretation as string} />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
