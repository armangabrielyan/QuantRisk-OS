// @ts-nocheck
import { useState } from 'react'
import { portfolioApi, dataApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Select, Button, DataTable
} from '@/components/ui'
import { fmtPct } from '@/lib/utils'
import Plot from 'react-plotly.js'

const TICKERS = ['SPY', 'GLD', 'TLT', 'JPM', 'BAC', 'QQQ', 'XLF', 'IEF']

type Tab = 'analytics' | 'frontier'

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<Tab>('analytics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Analytics state
  const [selectedTickers, setSelectedTickers] = useState(['SPY', 'GLD', 'TLT'])
  const [weights, setWeights] = useState([0.5, 0.3, 0.2])
  const [riskFreeRate, setRiskFreeRate] = useState(0.02)
  const [analyticsResult, setAnalyticsResult] = useState<Record<string, unknown> | null>(null)
  const [frontierResult, setFrontierResult] = useState<Record<string, unknown> | null>(null)

  const addTicker = () => {
    const next = TICKERS.find(t => !selectedTickers.includes(t))
    if (next && selectedTickers.length < 8) {
      const n = selectedTickers.length + 1
      const newWeights = [...weights.map(w => w * (n - 1) / n), 1 / n]
      setSelectedTickers([...selectedTickers, next])
      setWeights(newWeights)
    }
  }

  const removeTicker = (i: number) => {
    if (selectedTickers.length <= 2) return
    const newTickers = selectedTickers.filter((_, j) => j !== i)
    const newWeights = weights.filter((_, j) => j !== i)
    const sum = newWeights.reduce((a, b) => a + b, 0)
    setSelectedTickers(newTickers)
    setWeights(newWeights.map(w => w / sum))
  }

  const updateWeight = (i: number, val: string) => {
    const newWeights = [...weights]
    newWeights[i] = parseFloat(val) || 0
    setWeights(newWeights)
  }

  const normalizeWeights = () => {
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum > 0) setWeights(weights.map(w => Math.round(w / sum * 1000) / 1000))
  }

  async function fetchReturnsMatrix(): Promise<number[][]> {
    const results = await Promise.all(selectedTickers.map(t => dataApi.sample(t, 252)))
    return results.map(r => r.data.data.returns)
  }

  async function runAnalytics() {
    setLoading(true); setError(null); setAnalyticsResult(null)
    try {
      const returnsMatrix = await fetchReturnsMatrix()
      const sum = weights.reduce((a, b) => a + b, 0)
      const normWeights = weights.map(w => w / sum)
      const res = await portfolioApi.analytics({
        returns_matrix: returnsMatrix,
        weights: normWeights,
        asset_names: selectedTickers,
        risk_free_rate: riskFreeRate,
      })
      setAnalyticsResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  async function runFrontier() {
    setLoading(true); setError(null); setFrontierResult(null)
    try {
      const returnsMatrix = await fetchReturnsMatrix()
      const res = await portfolioApi.efficientFrontier({
        returns_matrix: returnsMatrix,
        asset_names: selectedTickers,
        n_portfolios: 1000,
        risk_free_rate: riskFreeRate,
      })
      setFrontierResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  const portReturn = analyticsResult?.portfolio_return as number | undefined
  const portVol = analyticsResult?.portfolio_volatility as number | undefined
  const sharpe = analyticsResult?.sharpe_ratio as number | undefined
  const sortino = analyticsResult?.sortino_ratio as number | undefined
  const mdd = analyticsResult?.max_drawdown as number | undefined

  return (
    <div className="space-y-6">
      <SectionHeader title="Portfolio Analytics" subtitle="Markowitz Optimization, Efficient Frontier, Risk Decomposition, Drawdown Analysis" />

      <div className="flex gap-1 border-b border-[#1e2635]">
        {(['analytics', 'frontier'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {tab === 'analytics' ? 'Portfolio Analytics' : 'Efficient Frontier'}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Shared portfolio setup */}
      <Panel title="Portfolio Composition">
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 pb-2 border-b border-[#1e2635]">
            <span>Asset</span><span>Weight</span><span>%</span><span></span>
          </div>
          {selectedTickers.map((ticker, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center">
              <Select value={ticker}
                onChange={e => setSelectedTickers(prev => prev.map((t, j) => j === i ? e.target.value : t))}>
                {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Input type="number" step="0.01" min="0" max="1" value={weights[i]?.toFixed(3) || '0'}
                onChange={e => updateWeight(i, e.target.value)} />
              <span className="font-mono text-xs text-slate-400">
                {fmtPct((weights[i] / weights.reduce((a, b) => a + b, 0)) * 100)}
              </span>
              <Button variant="danger" size="sm" onClick={() => removeTicker(i)}>×</Button>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={addTicker}>+ Add Asset</Button>
            <Button variant="secondary" size="sm" onClick={normalizeWeights}>Normalize Weights</Button>
            <FormField label="">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rf Rate:</span>
                <Input type="number" step="0.005" value={riskFreeRate} onChange={e => setRiskFreeRate(parseFloat(e.target.value))} className="w-24" />
              </div>
            </FormField>
            <div className="ml-auto flex gap-2">
              {activeTab === 'analytics'
                ? <Button onClick={runAnalytics} disabled={loading}>{loading ? 'Computing...' : 'Run Analytics'}</Button>
                : <Button onClick={runFrontier} disabled={loading}>{loading ? 'Optimizing...' : 'Build Efficient Frontier'}</Button>
              }
            </div>
          </div>
        </div>
      </Panel>

      {loading && <LoadingSpinner message={activeTab === 'analytics' ? 'Computing portfolio metrics...' : 'Building efficient frontier...'} />}

      {/* Analytics Results */}
      {activeTab === 'analytics' && analyticsResult && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            <MetricCard label="Annual Return" value={fmtPct((portReturn ?? 0) * 100)} status={(portReturn ?? 0) > 0 ? 'pass' : 'fail'} />
            <MetricCard label="Annual Volatility" value={fmtPct((portVol ?? 0) * 100)} />
            <MetricCard label="Sharpe Ratio" value={(sharpe ?? 0).toFixed(3)} status={(sharpe ?? 0) > 0.5 ? 'pass' : (sharpe ?? 0) > 0 ? 'warn' : 'fail'} />
            <MetricCard label="Sortino Ratio" value={(sortino ?? 0).toFixed(3)} status={(sortino ?? 0) > 0.5 ? 'pass' : 'warn'} />
            <MetricCard label="Max Drawdown" value={fmtPct((mdd ?? 0) * 100)} status={Math.abs(mdd ?? 0) < 0.10 ? 'pass' : Math.abs(mdd ?? 0) < 0.20 ? 'warn' : 'fail'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Asset breakdown */}
            <Panel title="Asset Breakdown">
              <DataTable
                headers={['Asset', 'Weight', 'Return (ann)', 'Vol (ann)', 'Risk Contrib']}
                rows={selectedTickers.map((t, i) => {
                  const aw = analyticsResult.weights as number[]
                  const ar = analyticsResult.asset_returns as number[]
                  const av = analyticsResult.asset_volatilities as number[]
                  const rc = analyticsResult.risk_contributions as number[] | undefined
                  return [
                    t,
                    fmtPct((aw[i] ?? 0) * 100),
                    fmtPct((ar[i] ?? 0) * 100),
                    fmtPct((av[i] ?? 0) * 100),
                    rc ? fmtPct((rc[i] ?? 0) * 100) : '—',
                  ]
                })}
              />
            </Panel>

            {/* Drawdown chart */}
            <Panel title="Portfolio Drawdown">
              {analyticsResult.drawdown_series && (
                <Plot
                  data={[{
                    y: (analyticsResult.drawdown_series as number[]).map(v => v * 100),
                    type: 'scatter',
                    mode: 'lines',
                    fill: 'tozeroy',
                    line: { color: '#ef4444', width: 1.5 },
                    fillcolor: 'rgba(239,68,68,0.15)',
                    name: 'Drawdown %',
                  }]}
                  layout={{
                    paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                    font: { color: '#94a3b8', size: 11 },
                    margin: { t: 10, r: 10, b: 30, l: 45 },
                    xaxis: { title: 'Days', gridcolor: '#1e2635' },
                    yaxis: { title: 'Drawdown %', gridcolor: '#1e2635' },
                    height: 220, showlegend: false,
                  }}
                  config={{ displayModeBar: false }}
                  style={{ width: '100%' }}
                />
              )}
            </Panel>
          </div>

          {/* Correlation heatmap */}
          <Panel title="Correlation Matrix">
            <Plot
              data={[{
                z: analyticsResult.correlation_matrix as number[][],
                x: selectedTickers,
                y: selectedTickers,
                type: 'heatmap',
                colorscale: [[0, '#1e3a5f'], [0.5, '#0f1117'], [1, '#065f46']],
                zmin: -1, zmax: 1,
                text: (analyticsResult.correlation_matrix as number[][]).map(row => row.map(v => v.toFixed(2))),
                texttemplate: '%{text}',
                hovertemplate: 'Correlation: %{z:.4f}<extra></extra>',
              }]}
              layout={{
                paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                font: { color: '#94a3b8', size: 11 },
                margin: { t: 10, r: 10, b: 50, l: 60 },
                height: 280,
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </Panel>
        </div>
      )}

      {/* Frontier Results */}
      {activeTab === 'frontier' && frontierResult && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {['min_vol_portfolio', 'max_sharpe_portfolio'].map(key => {
              const p = frontierResult[key] as Record<string, unknown>
              const label = key === 'min_vol_portfolio' ? 'Min-Volatility Portfolio' : 'Max-Sharpe Portfolio'
              return (
                <Panel key={key} title={label} className="col-span-1">
                  <DataTable
                    headers={['Metric', 'Value']}
                    rows={[
                      ['Annual Return', fmtPct((p.return as number) * 100)],
                      ['Annual Volatility', fmtPct((p.volatility as number) * 100)],
                      ['Sharpe Ratio', (p.sharpe as number).toFixed(3)],
                      ...Object.entries(p.weights as Record<string, number>).map(([t, w]) => [t, fmtPct(w * 100)]),
                    ]}
                  />
                </Panel>
              )
            })}

            <Panel title="Asset Summary" className="col-span-1">
              <DataTable
                headers={['Asset', 'Return', 'Volatility']}
                rows={(frontierResult.asset_names as string[]).map((name, i) => [
                  name,
                  fmtPct((frontierResult.asset_returns as number[])[i] * 100),
                  fmtPct((frontierResult.asset_vols as number[])[i] * 100),
                ])}
              />
            </Panel>
          </div>

          {/* Frontier scatter plot */}
          <Panel title="Markowitz Efficient Frontier">
            <Plot
              data={[
                {
                  x: (frontierResult.frontier_vols as number[]).map(v => v * 100),
                  y: (frontierResult.frontier_returns as number[]).map(v => v * 100),
                  type: 'scatter',
                  mode: 'markers',
                  marker: {
                    color: frontierResult.frontier_sharpes as number[],
                    colorscale: [[0, '#1e3a5f'], [0.5, '#10b981'], [1, '#f59e0b']],
                    size: 4,
                    colorbar: { title: 'Sharpe', titlefont: { color: '#94a3b8' }, tickfont: { color: '#94a3b8' } },
                  },
                  name: 'Portfolio',
                  hovertemplate: 'Vol: %{x:.2f}%<br>Ret: %{y:.2f}%<extra></extra>',
                },
                {
                  x: [(frontierResult.min_vol_portfolio as Record<string, number>).volatility * 100],
                  y: [(frontierResult.min_vol_portfolio as Record<string, number>).return * 100],
                  type: 'scatter',
                  mode: 'markers',
                  marker: { color: '#3b82f6', size: 14, symbol: 'star' },
                  name: 'Min-Vol',
                },
                {
                  x: [(frontierResult.max_sharpe_portfolio as Record<string, number>).volatility * 100],
                  y: [(frontierResult.max_sharpe_portfolio as Record<string, number>).return * 100],
                  type: 'scatter',
                  mode: 'markers',
                  marker: { color: '#f59e0b', size: 14, symbol: 'star' },
                  name: 'Max-Sharpe',
                },
                {
                  x: (frontierResult.asset_vols as number[]).map(v => v * 100),
                  y: (frontierResult.asset_returns as number[]).map(v => v * 100),
                  text: frontierResult.asset_names as string[],
                  type: 'scatter',
                  mode: 'markers+text',
                  marker: { color: '#94a3b8', size: 10, symbol: 'diamond' },
                  textposition: 'top center',
                  textfont: { color: '#94a3b8', size: 10 },
                  name: 'Assets',
                },
              ]}
              layout={{
                paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                font: { color: '#94a3b8', size: 11 },
                margin: { t: 20, r: 20, b: 50, l: 60 },
                xaxis: { title: 'Annual Volatility (%)', gridcolor: '#1e2635' },
                yaxis: { title: 'Annual Return (%)', gridcolor: '#1e2635' },
                height: 420,
                legend: { font: { color: '#94a3b8', size: 10 } },
              }}
              config={{ displayModeBar: true, displaylogo: false }}
              style={{ width: '100%' }}
            />
          </Panel>
        </div>
      )}
    </div>
  )
}
