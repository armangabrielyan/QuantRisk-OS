// @ts-nocheck
import { useState } from 'react'
import { marketRiskApi, dataApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Select, Button, DataTable
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import Plot from 'react-plotly.js'

type VaRMethod = 'parametric' | 'historical' | 'monte_carlo'
type VolMethod = 'historical' | 'ewma' | 'garch'
type ActiveTab = 'var' | 'volatility' | 'bsm' | 'surface'

export default function MarketRisk() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('var')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // VaR state
  const [varMethod, setVarMethod] = useState<VaRMethod>('parametric')
  const [ticker, setTicker] = useState('SPY')
  const [confidence, setConfidence] = useState(0.99)
  const [holdingPeriod, setHoldingPeriod] = useState(1)
  const [portfolioValue, setPortfolioValue] = useState(10_000_000)
  const [distribution, setDistribution] = useState('normal')
  const [nSimulations, setNSimulations] = useState(10000)
  const [varResult, setVarResult] = useState<Record<string, unknown> | null>(null)
  const [histogramData, setHistogramData] = useState<number[]>([])

  // Volatility state
  const [volMethod, setVolMethod] = useState<VolMethod>('ewma')
  const [lambda, setLambda] = useState(0.94)
  const [volResult, setVolResult] = useState<Record<string, unknown> | null>(null)

  // BSM state
  const [bsmParams, setBsmParams] = useState({
    S: 100, K: 100, T: 1.0, r: 0.05, sigma: 0.20, q: 0.0, option_type: 'call'
  })
  const [bsmResult, setBsmResult] = useState<Record<string, unknown> | null>(null)

  // Vol Surface state
  const [surfaceResult, setSurfaceResult] = useState<Record<string, unknown> | null>(null)

  async function getReturns(): Promise<number[]> {
    const res = await dataApi.sample(ticker, 504)
    return res.data.data.returns as number[]
  }

  async function runVaR() {
    setLoading(true)
    setError(null)
    setVarResult(null)
    setHistogramData([])
    try {
      const returns = await getReturns()
      let res
      if (varMethod === 'parametric') {
        res = await marketRiskApi.parametricVaR({ returns, confidence, holding_period: holdingPeriod, portfolio_value: portfolioValue, distribution })
      } else if (varMethod === 'historical') {
        res = await marketRiskApi.historicalVaR({ returns, confidence, holding_period: holdingPeriod, portfolio_value: portfolioValue })
        if (res.data.data.return_distribution) setHistogramData(res.data.data.return_distribution as number[])
      } else {
        res = await marketRiskApi.monteCarloVaR({
          portfolio_value: portfolioValue, mu: 0.0, sigma: 0.012,
          horizon: holdingPeriod, n_simulations: nSimulations, confidence, seed: 42
        })
        if (res.data.data.simulated_pnl) setHistogramData(res.data.data.simulated_pnl as number[])
      }
      setVarResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  async function runVolatility() {
    setLoading(true)
    setError(null)
    setVolResult(null)
    try {
      const returns = await getReturns()
      const res = await marketRiskApi.volatility({ returns, method: volMethod, lambda_: lambda })
      setVolResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  async function runBSM() {
    setLoading(true)
    setError(null)
    setBsmResult(null)
    try {
      const res = await marketRiskApi.blackScholes(bsmParams)
      setBsmResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  async function runVolSurface() {
    setLoading(true)
    setError(null)
    setSurfaceResult(null)
    try {
      const res = await marketRiskApi.volSurface({
        S: bsmParams.S,
        strikes: [70, 80, 90, 95, 100, 105, 110, 120, 130],
        maturities: [0.083, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0],
        r: bsmParams.r,
        q: bsmParams.q,
      })
      setSurfaceResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  const varNum = varResult?.var as number | undefined
  const esNum = varResult?.es as number | undefined

  return (
    <div className="space-y-6">
      <SectionHeader title="Market Risk" subtitle="VaR, Expected Shortfall, Volatility, Black-Scholes, Implied Volatility" />

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-[#1e2635]">
        {(['var', 'volatility', 'bsm', 'surface'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab === 'var' ? 'Value at Risk' : tab === 'volatility' ? 'Volatility' : tab === 'bsm' ? 'Black-Scholes' : 'Vol Surface'}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} onRetry={activeTab === 'var' ? runVaR : activeTab === 'volatility' ? runVolatility : runBSM} />}

      {/* VaR Tab */}
      {activeTab === 'var' && (
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Parameters" className="col-span-1">
            <div className="space-y-4">
              <FormField label="Ticker Symbol">
                <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="SPY" />
              </FormField>
              <FormField label="VaR Method">
                <Select value={varMethod} onChange={e => setVarMethod(e.target.value as VaRMethod)}>
                  <option value="parametric">Parametric (Normal/t)</option>
                  <option value="historical">Historical Simulation</option>
                  <option value="monte_carlo">Monte Carlo (GBM)</option>
                </Select>
              </FormField>
              <FormField label={`Confidence Level: ${(confidence * 100).toFixed(1)}%`}>
                <input
                  type="range" min={0.90} max={0.999} step={0.001}
                  value={confidence}
                  onChange={e => setConfidence(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>90%</span><span>95%</span><span>99%</span><span>99.9%</span>
                </div>
              </FormField>
              <FormField label="Holding Period (days)">
                <Select value={holdingPeriod} onChange={e => setHoldingPeriod(parseInt(e.target.value))}>
                  <option value={1}>1 day</option>
                  <option value={5}>5 days (1 week)</option>
                  <option value={10}>10 days (Basel)</option>
                  <option value={21}>21 days (1 month)</option>
                  <option value={63}>63 days (1 quarter)</option>
                </Select>
              </FormField>
              <FormField label="Portfolio Value ($)">
                <Input type="number" value={portfolioValue} onChange={e => setPortfolioValue(parseFloat(e.target.value))} />
              </FormField>
              {varMethod === 'parametric' && (
                <FormField label="Distribution">
                  <Select value={distribution} onChange={e => setDistribution(e.target.value)}>
                    <option value="normal">Normal</option>
                    <option value="student_t">Student-t (fat tails)</option>
                  </Select>
                </FormField>
              )}
              {varMethod === 'monte_carlo' && (
                <FormField label="Simulations">
                  <Select value={nSimulations} onChange={e => setNSimulations(parseInt(e.target.value))}>
                    <option value={1000}>1,000</option>
                    <option value={10000}>10,000</option>
                    <option value={50000}>50,000</option>
                    <option value={100000}>100,000</option>
                  </Select>
                </FormField>
              )}
              <Button onClick={runVaR} disabled={loading} className="w-full">
                {loading ? 'Calculating...' : 'Run VaR Analysis'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-2 space-y-4">
            {loading && <LoadingSpinner message={`Running ${varMethod} VaR...`} />}
            {varResult && !loading && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label={`${(confidence * 100).toFixed(1)}% VaR`} value={fmtCurrency(varNum!)} subValue={`${(varNum! / portfolioValue * 100).toFixed(3)}% of portfolio`} status="neutral" />
                  <MetricCard label="Expected Shortfall" value={fmtCurrency(esNum!)} subValue="CVaR beyond VaR" status="neutral" />
                  <MetricCard label="ES/VaR Ratio" value={(esNum! / varNum!).toFixed(3)} subValue="Should be > 1.0" status="pass" />
                </div>
                {varResult.mu_daily !== undefined && (
                  <Panel title="Distribution Parameters">
                    <DataTable
                      headers={['Parameter', 'Value', 'Annualized']}
                      rows={[
                        ['Daily Mean Return', fmtPct((varResult.mu_daily as number) * 100, 4), fmtPct((varResult.mu_daily as number) * 252 * 100, 2)],
                        ['Daily Volatility', fmtPct((varResult.sigma_daily as number) * 100, 4), fmtPct((varResult.sigma_daily as number) * Math.sqrt(252) * 100, 2)],
                        ['z-quantile', (varResult.z_alpha as number)?.toFixed(4), '—'],
                        ['Observations', String(varResult.n_observations), '—'],
                      ]}
                    />
                  </Panel>
                )}
                {histogramData.length > 0 && (
                  <Panel title="Return / P&L Distribution">
                    <Plot
                      data={[{
                        x: varMethod === 'monte_carlo' ? histogramData : histogramData.map(r => r * 100),
                        type: 'histogram',
                        nbinsx: 80,
                        marker: { color: 'rgba(16,185,129,0.6)', line: { color: '#10b981', width: 0.5 } },
                        name: varMethod === 'monte_carlo' ? 'P&L ($)' : 'Return (%)',
                      }, {
                        x: [varMethod === 'monte_carlo' ? -(varNum!) : -(varNum! / portfolioValue * 100), varMethod === 'monte_carlo' ? -(varNum!) : -(varNum! / portfolioValue * 100)],
                        y: [0, 2000],
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: '#ef4444', width: 2, dash: 'dash' },
                        name: `${(confidence * 100).toFixed(0)}% VaR`,
                      }]}
                      layout={{
                        paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                        font: { color: '#94a3b8', size: 11 },
                        margin: { t: 10, r: 10, b: 40, l: 50 },
                        xaxis: { title: varMethod === 'monte_carlo' ? 'P&L ($)' : 'Return (%)', gridcolor: '#1e2635' },
                        yaxis: { title: 'Frequency', gridcolor: '#1e2635' },
                        showlegend: true,
                        legend: { font: { color: '#94a3b8', size: 10 } },
                        height: 280,
                      }}
                      config={{ displayModeBar: false }}
                      style={{ width: '100%' }}
                    />
                  </Panel>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Volatility Tab */}
      {activeTab === 'volatility' && (
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Parameters" className="col-span-1">
            <div className="space-y-4">
              <FormField label="Ticker Symbol">
                <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} />
              </FormField>
              <FormField label="Method">
                <Select value={volMethod} onChange={e => setVolMethod(e.target.value as VolMethod)}>
                  <option value="historical">Historical (Simple)</option>
                  <option value="ewma">EWMA (RiskMetrics)</option>
                  <option value="garch">GARCH(1,1)</option>
                </Select>
              </FormField>
              {volMethod === 'ewma' && (
                <FormField label={`Lambda: ${lambda}`} hint="RiskMetrics default: 0.94">
                  <input type="range" min={0.70} max={0.99} step={0.01} value={lambda}
                    onChange={e => setLambda(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </FormField>
              )}
              <Button onClick={runVolatility} disabled={loading} className="w-full">
                {loading ? 'Estimating...' : 'Estimate Volatility'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-2 space-y-4">
            {loading && <LoadingSpinner />}
            {volResult && !loading && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Daily Volatility" value={fmtPct((volResult.volatility_daily as number) * 100, 4)} />
                  <MetricCard label="Annual Volatility" value={fmtPct((volResult.volatility_annual as number) * 100, 2)} subValue="×√252" />
                  <MetricCard label="Method" value={String(volResult.method)} mono={false} />
                </div>
                {volResult.omega !== undefined && (
                  <Panel title="GARCH(1,1) Parameters">
                    <DataTable
                      headers={['Parameter', 'Value', 'Interpretation']}
                      rows={[
                        ['ω (omega)', (volResult.omega as number).toExponential(4), 'Long-run variance weight'],
                        ['α (alpha)', (volResult.alpha as number).toFixed(6), 'ARCH term (shock impact)'],
                        ['β (beta)', (volResult.beta as number).toFixed(6), 'GARCH term (persistence)'],
                        ['α+β (persistence)', (volResult.persistence as number).toFixed(6), '< 1 for stationarity'],
                        ['Log-likelihood', (volResult.log_likelihood as number).toFixed(2), ''],
                        ['AIC', (volResult.aic as number).toFixed(2), ''],
                      ]}
                    />
                  </Panel>
                )}
                {volResult.lambda !== undefined && (
                  <Panel title="EWMA Parameters">
                    <DataTable
                      headers={['Parameter', 'Value']}
                      rows={[
                        ['Lambda (λ)', (volResult.lambda as number).toFixed(2)],
                        ['Weight on recent obs', ((1 - (volResult.lambda as number)) * 100).toFixed(1) + '%'],
                        ['Half-life (approx)', (Math.log(0.5) / Math.log(volResult.lambda as number)).toFixed(1) + ' days'],
                      ]}
                    />
                  </Panel>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Black-Scholes Tab */}
      {activeTab === 'bsm' && (
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Option Parameters" className="col-span-1">
            <div className="space-y-4">
              {[
                { key: 'S', label: 'Spot Price (S)', hint: 'Current asset price' },
                { key: 'K', label: 'Strike Price (K)', hint: 'Option strike' },
                { key: 'T', label: 'Maturity (T, years)', hint: 'e.g. 0.5 = 6 months' },
                { key: 'r', label: 'Risk-free Rate (r)', hint: 'Continuous, e.g. 0.05' },
                { key: 'sigma', label: 'Volatility (σ)', hint: 'Annual, e.g. 0.20' },
                { key: 'q', label: 'Dividend Yield (q)', hint: 'Continuous, 0 if none' },
              ].map(({ key, label, hint }) => (
                <FormField key={key} label={label} hint={hint}>
                  <Input
                    type="number"
                    step="0.01"
                    value={bsmParams[key as keyof typeof bsmParams] as number}
                    onChange={e => setBsmParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  />
                </FormField>
              ))}
              <FormField label="Option Type">
                <Select value={bsmParams.option_type} onChange={e => setBsmParams(prev => ({ ...prev, option_type: e.target.value }))}>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </Select>
              </FormField>
              <Button onClick={runBSM} disabled={loading} className="w-full">
                {loading ? 'Pricing...' : 'Price Option (BSM)'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-2 space-y-4">
            {loading && <LoadingSpinner />}
            {bsmResult && !loading && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Option Price" value={`$${(bsmResult.price as number).toFixed(4)}`} subValue="BSM theoretical" />
                  <MetricCard label="Intrinsic Value" value={`$${(bsmResult.intrinsic_value as number).toFixed(4)}`} />
                  <MetricCard label="Time Value" value={`$${(bsmResult.time_value as number).toFixed(4)}`} />
                </div>
                <Panel title="Greeks">
                  <div className="grid grid-cols-2 gap-4">
                    <DataTable
                      headers={['Greek', 'Value', 'Interpretation']}
                      rows={[
                        ['Delta (Δ)', (bsmResult.delta as number).toFixed(6), 'dPrice/dSpot'],
                        ['Gamma (Γ)', (bsmResult.gamma as number).toFixed(6), 'dDelta/dSpot'],
                        ['Vega (ν)', (bsmResult.vega as number).toFixed(6), 'dPrice/d(σ%) × 100'],
                        ['Theta (Θ)', (bsmResult.theta as number).toFixed(6), 'dPrice/dt (per day)'],
                        ['Rho (ρ)', (bsmResult.rho as number).toFixed(6), 'dPrice/d(r%) × 100'],
                      ]}
                    />
                    <DataTable
                      headers={['Parameter', 'Value']}
                      rows={[
                        ['d1', (bsmResult.d1 as number).toFixed(6)],
                        ['d2', (bsmResult.d2 as number).toFixed(6)],
                        ['N(d1) ≈ Delta (call)', (bsmResult.delta as number).toFixed(6)],
                        ['Moneyness (S/K)', (bsmResult.moneyness as number).toFixed(4)],
                        ['S/K > 1 = ITM call', bsmResult.moneyness as number > 1 ? 'ITM' : bsmResult.moneyness as number < 1 ? 'OTM' : 'ATM'],
                      ]}
                    />
                  </div>
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* Vol Surface Tab */}
      {activeTab === 'surface' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <FormField label="Spot Price (S)">
              <Input type="number" value={bsmParams.S}
                onChange={e => setBsmParams(prev => ({ ...prev, S: parseFloat(e.target.value) }))}
                className="w-32"
              />
            </FormField>
            <FormField label="Risk-free Rate">
              <Input type="number" step="0.01" value={bsmParams.r}
                onChange={e => setBsmParams(prev => ({ ...prev, r: parseFloat(e.target.value) }))}
                className="w-24"
              />
            </FormField>
            <div className="flex items-end">
              <Button onClick={runVolSurface} disabled={loading}>
                {loading ? 'Building Surface...' : 'Generate Vol Surface'}
              </Button>
            </div>
          </div>
          {loading && <LoadingSpinner message="Computing implied volatility surface..." />}
          {surfaceResult && !loading && (
            <Panel title="Implied Volatility Surface (3D)">
              <Plot
                data={[{
                  x: surfaceResult.strikes as number[],
                  y: surfaceResult.maturities as number[],
                  z: surfaceResult.iv_surface as number[][],
                  type: 'surface',
                  colorscale: [
                    [0, '#1e3a5f'], [0.25, '#1e6b3a'], [0.5, '#10b981'],
                    [0.75, '#f59e0b'], [1, '#ef4444']
                  ],
                  contours: { z: { show: true, usecolormap: true, highlightcolor: '#42f462', project: { z: true } } },
                  colorbar: { title: 'IV', titlefont: { color: '#94a3b8' }, tickfont: { color: '#94a3b8' } },
                }]}
                layout={{
                  paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                  font: { color: '#94a3b8', size: 11 },
                  scene: {
                    xaxis: { title: 'Strike', gridcolor: '#1e2635', color: '#64748b' },
                    yaxis: { title: 'Maturity (yrs)', gridcolor: '#1e2635', color: '#64748b' },
                    zaxis: { title: 'Implied Vol', gridcolor: '#1e2635', color: '#64748b' },
                    bgcolor: '#0f1117',
                  },
                  margin: { t: 20, r: 20, b: 20, l: 20 },
                  height: 480,
                  annotations: surfaceResult.synthetic ? [{
                    text: 'Synthetic surface (no market prices provided)',
                    showarrow: false,
                    x: 0.5, y: 0.02,
                    xref: 'paper', yref: 'paper',
                    font: { color: '#f59e0b', size: 11 }
                  }] : [],
                }}
                config={{ displayModeBar: true }}
                style={{ width: '100%' }}
              />
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}
