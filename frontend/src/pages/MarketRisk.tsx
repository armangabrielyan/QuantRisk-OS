// @ts-nocheck
import { useState } from 'react'
import { marketRiskApi, dataApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Select, Button, DataTable, Tabs,
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { useI18n } from '@/i18n'
import Plot from 'react-plotly.js'

type VarMethod = 'parametric' | 'historical' | 'monte_carlo'
type VolMethod = 'historical' | 'ewma' | 'garch'
type Tab = 'var' | 'volatility' | 'bsm' | 'surface' | 'varBacktest' | 'lVar'

const SAMPLE_RETURNS_KEY = 'SPY'

export default function MarketRisk() {
  const { t } = useI18n()
  const mr = t.marketRisk
  const [activeTab, setActiveTab] = useState<Tab>('var')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // VaR state
  const [varMethod, setVarMethod] = useState<VarMethod>('parametric')
  const [holdingPeriod, setHoldingPeriod] = useState(1)
  const [confidence, setConfidence] = useState(0.99)
  const [portfolioValue, setPortfolioValue] = useState(1_000_000)
  const [distribution, setDistribution] = useState('normal')
  const [nSimulations, setNSimulations] = useState(10000)
  const [varResult, setVarResult] = useState<Record<string, unknown> | null>(null)

  // Volatility state
  const [volMethod, setVolMethod] = useState<VolMethod>('ewma')
  const [lambda_, setLambda] = useState(0.94)
  const [volResult, setVolResult] = useState<Record<string, unknown> | null>(null)

  // BSM state
  const [bsmParams, setBsmParams] = useState({ S: 100, K: 100, T: 1.0, r: 0.05, sigma: 0.20, q: 0.0, option_type: 'call' })
  const [bsmResult, setBsmResult] = useState<Record<string, unknown> | null>(null)

  // Vol surface state
  const [surfaceSpot, setSurfaceSpot] = useState(100)
  const [surfaceRate, setSurfaceRate] = useState(0.05)
  const [surfaceResult, setSurfaceResult] = useState<Record<string, unknown> | null>(null)

  // VaR Backtest state
  const [backtestReturns, setBacktestReturns] = useState('-0.01, 0.02, -0.03, -0.05, 0.01')
  const [backtestVars, setBacktestVars] = useState('0.02, 0.02, 0.02, 0.02, 0.02')
  const [backtestConf, setBacktestConf] = useState(0.99)
  const [backtestResult, setBacktestResult] = useState<Record<string, unknown> | null>(null)

  // L-VaR state
  const [lVarBase, setLVarBase] = useState(100000)
  const [lVarSpread, setLVarSpread] = useState(0.001)
  const [lVarSpreadVol, setLVarSpreadVol] = useState(0.0005)
  const [lVarConf, setLVarConf] = useState(0.99)
  const [lVarPosSize, setLVarPosSize] = useState(1000000)
  const [lVarResult, setLVarResult] = useState<Record<string, unknown> | null>(null)

  async function getSampleReturns(): Promise<number[]> {
    const res = await dataApi.sample(SAMPLE_RETURNS_KEY, 252)
    return res.data.data.returns
  }

  async function runVaR() {
    setLoading(true); setError(null); setVarResult(null)
    try {
      const returns = await getSampleReturns()
      let res
      if (varMethod === 'parametric') {
        res = await marketRiskApi.parametricVaR({ returns, confidence, holding_period: holdingPeriod, portfolio_value: portfolioValue, distribution })
      } else if (varMethod === 'historical') {
        res = await marketRiskApi.historicalVaR({ returns, confidence, holding_period: holdingPeriod, portfolio_value: portfolioValue })
      } else {
        const volRes = await marketRiskApi.volatility({ returns, method: 'ewma', lambda_: 0.94 })
        const sigma = volRes.data.data.volatility_daily
        const mu = returns.reduce((a, b) => a + b, 0) / returns.length
        res = await marketRiskApi.monteCarloVaR({ portfolio_value: portfolioValue, mu, sigma, horizon: holdingPeriod, n_simulations: nSimulations, confidence })
      }
      setVarResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally { setLoading(false) }
  }

  async function runVolatility() {
    setLoading(true); setError(null); setVolResult(null)
    try {
      const returns = await getSampleReturns()
      const res = await marketRiskApi.volatility({ returns, method: volMethod, lambda_: lambda_ })
      setVolResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally { setLoading(false) }
  }

  async function runBSM() {
    setLoading(true); setError(null); setBsmResult(null)
    try {
      const res = await marketRiskApi.blackScholes(bsmParams)
      setBsmResult({ ...res.data.data, moneyness: bsmParams.S / bsmParams.K })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally { setLoading(false) }
  }

  async function runSurface() {
    setLoading(true); setError(null); setSurfaceResult(null)
    try {
      const strikes = [80, 85, 90, 95, 100, 105, 110, 115, 120].map(k => k * surfaceSpot / 100)
      const maturities = [0.083, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
      const res = await marketRiskApi.volSurface({ S: surfaceSpot, strikes, maturities, r: surfaceRate })
      setSurfaceResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally { setLoading(false) }
  }

  async function runBacktest() {
    setLoading(true); setError(null); setBacktestResult(null)
    try {
      const res = await marketRiskApi.varBacktest({
        returns: backtestReturns.split(',').map(s => parseFloat(s.trim())),
        historical_vars: backtestVars.split(',').map(s => parseFloat(s.trim())),
        confidence: backtestConf
      })
      setBacktestResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally { setLoading(false) }
  }

  async function runLVar() {
    setLoading(true); setError(null); setLVarResult(null)
    try {
      const res = await marketRiskApi.lVar({
        var: lVarBase, spread: lVarSpread, spread_vol: lVarSpreadVol,
        confidence: lVarConf, position_size: lVarPosSize
      })
      setLVarResult(res.data.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally { setLoading(false) }
  }

  const tabs = [
    { key: 'var', label: mr.tabs.var },
    { key: 'volatility', label: mr.tabs.volatility },
    { key: 'bsm', label: mr.tabs.bsm },
    { key: 'surface', label: mr.tabs.surface },
    { key: 'varBacktest', label: t.newFeatures.varBacktesting },
    { key: 'lVar', label: t.newFeatures.lVar },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={mr.title} subtitle={mr.subtitle} />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── VaR Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'var' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title={t.common.parameters}>
              <div className="space-y-3">
                <FormField label={mr.var.methodParam}>
                  <Select value={varMethod} onChange={e => setVarMethod(e.target.value as VarMethod)}>
                    <option value="parametric">{mr.var.methodParametric}</option>
                    <option value="historical">{mr.var.methodHistorical}</option>
                    <option value="monte_carlo">{mr.var.methodMC}</option>
                  </Select>
                </FormField>
                <FormField label={mr.var.holdingPeriod}>
                  <Select value={holdingPeriod} onChange={e => setHoldingPeriod(parseInt(e.target.value))}>
                    <option value={1}>{mr.var.day1}</option>
                    <option value={5}>{mr.var.day5}</option>
                    <option value={10}>{mr.var.day10}</option>
                    <option value={21}>{mr.var.day21}</option>
                    <option value={63}>{mr.var.day63}</option>
                  </Select>
                </FormField>
                <FormField label={`${t.common.confidence} (${(confidence * 100).toFixed(0)}%)`}>
                  <input type="range" min={0.90} max={0.999} step={0.001} value={confidence}
                    onChange={e => setConfidence(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                </FormField>
                <FormField label={mr.var.portfolioValue}>
                  <Input type="number" value={portfolioValue} onChange={e => setPortfolioValue(parseFloat(e.target.value))} />
                </FormField>
                {varMethod === 'parametric' && (
                  <FormField label={mr.var.distribution}>
                    <Select value={distribution} onChange={e => setDistribution(e.target.value)}>
                      <option value="normal">{mr.var.distNormal}</option>
                      <option value="student_t">{mr.var.distStudentT}</option>
                    </Select>
                  </FormField>
                )}
                {varMethod === 'monte_carlo' && (
                  <FormField label={mr.var.simulations}>
                    <Select value={nSimulations} onChange={e => setNSimulations(parseInt(e.target.value))}>
                      {[1000, 5000, 10000, 50000].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}
                    </Select>
                  </FormField>
                )}
                <Button onClick={runVaR} disabled={loading} className="w-full">
                  {loading ? mr.var.running : mr.var.runBtn}
                </Button>
              </div>
            </Panel>

            <div className="lg:col-span-2 space-y-4">
              {loading && <LoadingSpinner message={mr.var.runningVar} />}
              {varResult && !loading && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <MetricCard label={`${(confidence * 100).toFixed(0)}${mr.var.varLabel}`} value={fmtCurrency(varResult.var as number)}
                      subValue={fmtPct((varResult.var as number) / portfolioValue * 100)} status="fail" />
                    <MetricCard label={mr.var.esLabel} value={fmtCurrency(varResult.es as number)}
                      subValue={mr.var.esSubtext} status="fail" />
                    <MetricCard label={mr.var.esVarRatio} value={((varResult.es as number) / (varResult.var as number)).toFixed(3)}
                      subValue={mr.var.esVarNote} status={(varResult.es as number) > (varResult.var as number) ? 'pass' : 'fail'} />
                  </div>
                  {varMethod === 'parametric' && varResult.sigma_daily && (
                    <Panel title={mr.var.distParams}>
                      <DataTable
                        headers={mr.var.paramHeaders}
                        rows={[
                          [mr.var.dailyMean, `${((varResult.mu_daily as number) * 100).toFixed(4)}%`, `${((varResult.mu_daily as number) * 252 * 100).toFixed(2)}%`],
                          [mr.var.dailyVol, `${((varResult.sigma_daily as number) * 100).toFixed(4)}%`, `${((varResult.sigma_daily as number) * Math.sqrt(252) * 100).toFixed(2)}%`],
                          [mr.var.zQuantile, (varResult.z_alpha as number).toFixed(4), ''],
                          [mr.var.observations, varResult.n_observations as number, ''],
                        ]}
                      />
                    </Panel>
                  )}
                  {varResult.simulated_pnl && (
                    <Panel title={mr.var.distribution2}>
                      <Plot
                        data={[{
                          x: (varResult.simulated_pnl as number[]).slice(0, 3000),
                          type: 'histogram', nbinsx: 80,
                          marker: { color: '#10b981', opacity: 0.7 },
                          name: mr.var.pnlDollar,
                        }]}
                        layout={{
                          paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                          font: { color: '#94a3b8', size: 10 },
                          margin: { t: 10, r: 10, b: 40, l: 50 },
                          xaxis: { title: mr.var.pnlDollar, gridcolor: '#1e2635', tickformat: '$,.0f' },
                          yaxis: { title: mr.var.frequency, gridcolor: '#1e2635' },
                          height: 220, showlegend: false,
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                      />
                    </Panel>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Volatility Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'volatility' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.common.method}>
                <Select value={volMethod} onChange={e => setVolMethod(e.target.value as VolMethod)}>
                  <option value="historical">{mr.volatility.methodHistorical}</option>
                  <option value="ewma">{mr.volatility.methodEWMA}</option>
                  <option value="garch">{mr.volatility.methodGARCH}</option>
                </Select>
              </FormField>
              {volMethod === 'ewma' && (
                <FormField label={`${mr.volatility.lambdaLabel}: ${lambda_.toFixed(3)}`}>
                  <input type="range" min={0.80} max={0.99} step={0.005} value={lambda_}
                    onChange={e => setLambda(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                </FormField>
              )}
              <Button onClick={runVolatility} disabled={loading} className="w-full">
                {loading ? mr.volatility.running : mr.volatility.runBtn}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={mr.volatility.running} />}
            {volResult && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <MetricCard label={mr.volatility.dailyVol} value={fmtPct((volResult.volatility_daily as number) * 100)} />
                  <MetricCard label={mr.volatility.annualVol} value={fmtPct((volResult.volatility_annual as number) * 100)} subValue={mr.volatility.annualNote} />
                  <MetricCard label={mr.volatility.method} value={volResult.method as string} />
                </div>
                {volMethod === 'garch' && volResult.omega !== undefined && (
                  <Panel title={mr.volatility.garchParams}>
                    <DataTable
                      headers={mr.volatility.garchHeaders}
                      rows={[
                        [mr.volatility.omega, (volResult.omega as number).toExponential(4), mr.volatility.omegaInterp],
                        [mr.volatility.alpha, (volResult.alpha as number).toFixed(4), mr.volatility.alphaInterp],
                        [mr.volatility.beta, (volResult.beta as number).toFixed(4), mr.volatility.betaInterp],
                        [mr.volatility.persistence, ((volResult.alpha as number) + (volResult.beta as number)).toFixed(4), mr.volatility.persInterp],
                        [mr.volatility.logLik, (volResult.log_likelihood as number).toFixed(2), ''],
                      ]}
                    />
                  </Panel>
                )}
                {volMethod === 'ewma' && (
                  <Panel title={mr.volatility.ewmaParams}>
                    <DataTable
                      headers={mr.volatility.garchHeaders}
                      rows={[
                        [mr.volatility.lambdaParam, (volResult.lambda as number).toFixed(3), ''],
                        [mr.volatility.weightRecent, `${((1 - (volResult.lambda as number)) * 100).toFixed(1)}%`, ''],
                        [mr.volatility.halfLife, `${(Math.log(0.5) / Math.log(volResult.lambda as number)).toFixed(1)} ${mr.volatility.days}`, ''],
                      ]}
                    />
                  </Panel>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── BSM Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'bsm' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              {[
                { key: 'S', label: mr.bsm.spotPrice, hint: mr.bsm.spotHint },
                { key: 'K', label: mr.bsm.strike, hint: mr.bsm.strikeHint },
                { key: 'T', label: mr.bsm.maturity, hint: mr.bsm.maturityHint },
                { key: 'r', label: mr.bsm.riskFree, hint: mr.bsm.riskFreeHint },
                { key: 'sigma', label: mr.bsm.sigmaVol, hint: mr.bsm.sigmaHint },
                { key: 'q', label: mr.bsm.dividendYield, hint: mr.bsm.dividendHint },
              ].map(({ key, label, hint }) => (
                <FormField key={key} label={label} hint={hint}>
                  <Input type="number" step="0.01" value={bsmParams[key]}
                    onChange={e => setBsmParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))} />
                </FormField>
              ))}
              <FormField label={mr.bsm.optionType}>
                <Select value={bsmParams.option_type} onChange={e => setBsmParams(p => ({ ...p, option_type: e.target.value }))}>
                  <option value="call">{mr.bsm.call}</option>
                  <option value="put">{mr.bsm.put}</option>
                </Select>
              </FormField>
              <Button onClick={runBSM} disabled={loading} className="w-full">
                {loading ? mr.bsm.running : mr.bsm.runBtn}
              </Button>
            </div>
          </Panel>

          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={mr.bsm.running} />}
            {bsmResult && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <MetricCard label={mr.bsm.optionPrice} value={`$${(bsmResult.price as number).toFixed(4)}`} subValue={mr.bsm.bsmTheo} />
                  <MetricCard label={mr.bsm.intrinsic} value={`$${Math.max(0, bsmParams.option_type === 'call' ? bsmParams.S - bsmParams.K : bsmParams.K - bsmParams.S).toFixed(4)}`} />
                  <MetricCard label={mr.bsm.timeValue} value={`$${((bsmResult.price as number) - Math.max(0, bsmParams.option_type === 'call' ? bsmParams.S - bsmParams.K : bsmParams.K - bsmParams.S)).toFixed(4)}`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Panel title={mr.bsm.greeks}>
                    <DataTable
                      headers={mr.bsm.greekHeaders}
                      rows={[
                        [mr.bsm.delta, (bsmResult.delta as number).toFixed(6), mr.bsm.deltaInterp],
                        [mr.bsm.gamma, (bsmResult.gamma as number).toFixed(6), mr.bsm.gammaInterp],
                        [mr.bsm.vega, (bsmResult.vega as number).toFixed(6), mr.bsm.vegaInterp],
                        [mr.bsm.theta, (bsmResult.theta as number).toFixed(6), mr.bsm.thetaInterp],
                        [mr.bsm.rho, (bsmResult.rho as number).toFixed(6), mr.bsm.rhoInterp],
                      ]}
                    />
                  </Panel>
                  <Panel title="d1, d2">
                    <DataTable
                      headers={mr.bsm.paramsHeaders}
                      rows={[
                        [mr.bsm.d1, (bsmResult.d1 as number).toFixed(6)],
                        [mr.bsm.d2, (bsmResult.d2 as number).toFixed(6)],
                        [mr.bsm.nd1, (bsmResult.delta as number).toFixed(6)],
                        [mr.bsm.moneyness, (bsmResult.moneyness as number).toFixed(4)],
                        [mr.bsm.moneyness, (bsmResult.moneyness as number) > 1 ? mr.bsm.itm : (bsmResult.moneyness as number) < 1 ? mr.bsm.otm : mr.bsm.atm],
                      ]}
                    />
                  </Panel>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Vol Surface Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'surface' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FormField label={mr.surface.spotPrice}>
              <Input type="number" value={surfaceSpot} onChange={e => setSurfaceSpot(parseFloat(e.target.value))} />
            </FormField>
            <FormField label={mr.surface.riskFreeRate}>
              <Input type="number" step="0.01" value={surfaceRate} onChange={e => setSurfaceRate(parseFloat(e.target.value))} />
            </FormField>
            <div className="flex items-end">
              <Button onClick={runSurface} disabled={loading} className="w-full">
                {loading ? mr.surface.running : mr.surface.runBtn}
              </Button>
            </div>
          </div>
          {loading && <LoadingSpinner message={mr.surface.computing} />}
          {surfaceResult && !loading && (
            <Panel title={mr.surface.title}>
              <div className="text-xs text-slate-500 mb-2">{mr.surface.syntheticNote}</div>
              <Plot
                data={[{
                  type: 'surface',
                  x: surfaceResult.strikes,
                  y: surfaceResult.maturities,
                  z: surfaceResult.iv_surface,
                  colorscale: [[0, '#1e3a5f'], [0.5, '#10b981'], [1, '#f59e0b']],
                  colorbar: { title: mr.surface.impliedVol, titlefont: { color: '#94a3b8' }, tickfont: { color: '#94a3b8' } },
                }]}
                layout={{
                  paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                  font: { color: '#94a3b8', size: 10 },
                  margin: { t: 20, r: 20, b: 20, l: 20 },
                  scene: {
                    xaxis: { title: mr.surface.strike, gridcolor: '#1e2635', color: '#94a3b8' },
                    yaxis: { title: mr.surface.maturity, gridcolor: '#1e2635', color: '#94a3b8' },
                    zaxis: { title: mr.surface.impliedVol, gridcolor: '#1e2635', color: '#94a3b8' },
                    bgcolor: '#0f1117',
                  },
                  height: 380,
                }}
                config={{ displayModeBar: true, displaylogo: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </Panel>
          )}
        </div>
      )}

      {/* ── VaR Backtest Tab ──────────────────────────────────────────────── */}
      {activeTab === 'varBacktest' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.historicalReturns}>
                <Input value={backtestReturns} onChange={e => setBacktestReturns(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.historicalVar}>
                <Input value={backtestVars} onChange={e => setBacktestVars(e.target.value)} />
              </FormField>
              <FormField label={`${t.common.confidence} (${(backtestConf * 100).toFixed(0)}%)`}>
                <input type="range" min={0.90} max={0.999} step={0.001} value={backtestConf}
                  onChange={e => setBacktestConf(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
              </FormField>
              <Button onClick={runBacktest} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {backtestResult && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <MetricCard label={t.newFeatures.exceptions} value={String(backtestResult?.exceptions)} />
                  <MetricCard label={t.newFeatures.expectedExceptions} value={String(backtestResult?.expected_exceptions)} />
                  <MetricCard label={t.newFeatures.exceptionRate} value={fmtPct(((backtestResult?.exception_rate as number) || 0) * 100)} />
                  <MetricCard label={t.newFeatures.kupiecStat} value={(backtestResult?.kupiec_stat as number)?.toFixed(4)} />
                  <MetricCard label={t.newFeatures.pValue} value={(backtestResult?.kupiec_pvalue as number)?.toFixed(4)} />
                  <MetricCard label={t.newFeatures.kupiecStatus} value={backtestResult?.kupiec_status as string} status={backtestResult?.kupiec_status === 'Accept' ? 'pass' : 'fail'} />
                  <MetricCard label={t.newFeatures.baselZone} value={backtestResult.basel_zone as string} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── L-VaR Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'lVar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.baseVar}>
                <Input type="number" value={lVarBase} onChange={e => setLVarBase(parseFloat(e.target.value))} />
              </FormField>
              <FormField label={t.newFeatures.bidAskSpread}>
                <Input type="number" step="0.001" value={lVarSpread} onChange={e => setLVarSpread(parseFloat(e.target.value))} />
              </FormField>
              <FormField label={t.newFeatures.spreadVolatility}>
                <Input type="number" step="0.0001" value={lVarSpreadVol} onChange={e => setLVarSpreadVol(parseFloat(e.target.value))} />
              </FormField>
              <FormField label={`${t.common.confidence} (${(lVarConf * 100).toFixed(0)}%)`}>
                <input type="range" min={0.90} max={0.999} step={0.001} value={lVarConf}
                  onChange={e => setLVarConf(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
              </FormField>
              <FormField label={t.newFeatures.positionSize}>
                <Input type="number" value={lVarPosSize} onChange={e => setLVarPosSize(parseFloat(e.target.value))} />
              </FormField>
              <Button onClick={runLVar} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {lVarResult && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <MetricCard label={t.newFeatures.baseVar} value={fmtCurrency(lVarResult.base_var as number)} />
                  <MetricCard label={t.newFeatures.liquidityCost} value={fmtCurrency(lVarResult.liquidity_cost as number)} />
                  <MetricCard label={t.newFeatures.lVar} value={fmtCurrency(lVarResult.l_var as number)} status="fail" />
                  <MetricCard label={t.newFeatures.spreadImpact} value={fmtPct((lVarResult.spread_impact_pct as number) * 100)} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
