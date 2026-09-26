import { useState } from 'react'
import { econometricsApi, dataApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Select, Button, DataTable
} from '@/components/ui'
import Plot from 'react-plotly.js'

type ActiveTab = 'timeseries' | 'ols' | 'diagnostics'

export default function Econometrics() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeseries')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticker, setTicker] = useState('SPY')

  // Time series
  const [regression, setRegression] = useState('c')
  const [nlags, setNlags] = useState(40)
  const [tsResult, setTsResult] = useState<Record<string, unknown> | null>(null)
  const [acfResult, setAcfResult] = useState<Record<string, unknown> | null>(null)

  // OLS
  const [olsTicker2, setOlsTicker2] = useState('JPM')
  const [olsResult, setOlsResult] = useState<Record<string, unknown> | null>(null)
  const [diagResult, setDiagResult] = useState<Record<string, unknown> | null>(null)

  async function runTimeSeries() {
    setLoading(true); setError(null); setTsResult(null); setAcfResult(null)
    try {
      const res = await dataApi.sample(ticker, 504)
      const series = res.data.data.returns as number[]
      const [ts, acf] = await Promise.all([
        econometricsApi.timeSeries({ series, regression, nlags }),
        econometricsApi.acfPacf({ series, nlags }),
      ])
      setTsResult(ts.data.data)
      setAcfResult(acf.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  async function runOLS() {
    setLoading(true); setError(null); setOlsResult(null); setDiagResult(null)
    try {
      const [r1, r2] = await Promise.all([dataApi.sample(ticker, 252), dataApi.sample(olsTicker2, 252)])
      const y = r1.data.data.returns as number[]
      const X = (r2.data.data.returns as number[]).map((v: number) => [v])
      const [ols, diag] = await Promise.all([
        econometricsApi.ols({ y, X, feature_names: [olsTicker2], add_constant: true }),
        econometricsApi.diagnostics({ y, X }),
      ])
      setOlsResult(ols.data.data)
      setDiagResult(diag.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  const adf = tsResult?.adf_test as Record<string, unknown> | undefined
  const desc = tsResult?.descriptive_stats as Record<string, unknown> | undefined
  const acf = acfResult?.acf as number[] | undefined
  const pacf = acfResult?.pacf as number[] | undefined
  const lags = acfResult?.lags as number[] | undefined
  const sigBound = acfResult?.significance_bound as number | undefined

  return (
    <div className="space-y-6">
      <SectionHeader title="Econometrics Workspace" subtitle="ADF Test, ACF/PACF, OLS Regression, Heteroskedasticity, Serial Correlation, VIF" />

      <div className="flex gap-1 border-b border-[#1e2635]">
        {(['timeseries', 'ols'] as ActiveTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {tab === 'timeseries' ? 'Time Series Diagnostics' : 'OLS Regression'}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      {activeTab === 'timeseries' && (
        <div className="grid grid-cols-4 gap-4">
          <Panel title="Parameters" className="col-span-1">
            <div className="space-y-4">
              <FormField label="Ticker">
                <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} />
              </FormField>
              <FormField label="ADF Regression" hint="c=constant, ct=constant+trend">
                <Select value={regression} onChange={e => setRegression(e.target.value)}>
                  <option value="c">Constant (c)</option>
                  <option value="ct">Constant + Trend (ct)</option>
                  <option value="n">None (n)</option>
                </Select>
              </FormField>
              <FormField label={`ACF/PACF Lags: ${nlags}`}>
                <input type="range" min={10} max={60} value={nlags}
                  onChange={e => setNlags(parseInt(e.target.value))}
                  className="w-full accent-emerald-500" />
              </FormField>
              <Button onClick={runTimeSeries} disabled={loading} className="w-full">
                {loading ? 'Running...' : 'Run Diagnostics'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-3 space-y-4">
            {loading && <LoadingSpinner />}
            {tsResult && !loading && (
              <>
                {/* Descriptive Stats */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['Mean', `${((desc?.mean as number) * 100).toFixed(4)}%`],
                    ['Std Dev', `${((desc?.std as number) * 100).toFixed(4)}%`],
                    ['Skewness', (desc?.skewness as number)?.toFixed(4)],
                    ['Excess Kurt', (desc?.excess_kurtosis as number)?.toFixed(4)],
                  ].map(([label, val]) => (
                    <MetricCard key={label as string} label={label as string} value={val as string} />
                  ))}
                </div>

                {/* ADF Test */}
                <Panel title="ADF Unit Root Test">
                  <DataTable
                    headers={['Metric', 'Value']}
                    rows={[
                      ['ADF Statistic', (adf?.statistic as number)?.toFixed(6)],
                      ['p-value', (adf?.pvalue as number)?.toFixed(6)],
                      ['Lags Used', String(adf?.usedlag)],
                      ['1% Critical Value', String((adf?.critical_values as Record<string, number>)?.['1%']?.toFixed(4))],
                      ['5% Critical Value', String((adf?.critical_values as Record<string, number>)?.['5%']?.toFixed(4))],
                      ['10% Critical Value', String((adf?.critical_values as Record<string, number>)?.['10%']?.toFixed(4))],
                    ]}
                  />
                  <div className={`mt-3 p-3 rounded text-xs border ${(adf?.pvalue as number) < 0.05 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                    {adf?.interpretation as string}
                  </div>
                </Panel>

                {/* ACF/PACF Charts */}
                {acf && pacf && lags && (
                  <div className="grid grid-cols-2 gap-4">
                    {[['Autocorrelation Function (ACF)', acf], ['Partial Autocorrelation Function (PACF)', pacf]].map(([title, vals]) => (
                      <Panel key={title as string} title={title as string}>
                        <Plot
                          data={[{
                            x: lags,
                            y: vals as number[],
                            type: 'bar',
                            marker: { color: (vals as number[]).map(v => Math.abs(v) > (sigBound || 0.09) ? '#10b981' : '#334155') },
                            name: title as string,
                          }, {
                            x: [0, lags[lags.length - 1]],
                            y: [sigBound || 0.09, sigBound || 0.09],
                            type: 'scatter', mode: 'lines',
                            line: { color: '#f59e0b', width: 1, dash: 'dot' },
                            name: '95% CI',
                            showlegend: false,
                          }, {
                            x: [0, lags[lags.length - 1]],
                            y: [-(sigBound || 0.09), -(sigBound || 0.09)],
                            type: 'scatter', mode: 'lines',
                            line: { color: '#f59e0b', width: 1, dash: 'dot' },
                            showlegend: false,
                          }]}
                          layout={{
                            paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                            font: { color: '#94a3b8', size: 10 },
                            margin: { t: 10, r: 10, b: 30, l: 40 },
                            xaxis: { title: 'Lag', gridcolor: '#1e2635' },
                            yaxis: { title: 'Correlation', gridcolor: '#1e2635', range: [-1, 1] },
                            height: 200, showlegend: false,
                          }}
                          config={{ displayModeBar: false }}
                          style={{ width: '100%' }}
                        />
                      </Panel>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ols' && (
        <div className="grid grid-cols-4 gap-4">
          <Panel title="Regression Setup" className="col-span-1">
            <div className="space-y-4">
              <FormField label="Dependent (Y)" hint="Daily returns">
                <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} />
              </FormField>
              <FormField label="Independent (X)" hint="Single regressor">
                <Input value={olsTicker2} onChange={e => setOlsTicker2(e.target.value.toUpperCase())} />
              </FormField>
              <div className="text-xs text-slate-500 p-3 bg-[#0f1117] rounded border border-[#1e2635]">
                Regresses {ticker} daily returns on {olsTicker2} daily returns with constant. Uses 252 trading days.
              </div>
              <Button onClick={runOLS} disabled={loading} className="w-full">
                {loading ? 'Regressing...' : 'Run OLS Regression'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-3 space-y-4">
            {loading && <LoadingSpinner />}
            {olsResult && !loading && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['R²', (olsResult.r_squared as number)?.toFixed(4)],
                    ['Adj R²', (olsResult.adj_r_squared as number)?.toFixed(4)],
                    ['F-Stat', (olsResult.f_statistic as number)?.toFixed(4)],
                    ['Obs', String(olsResult.n_obs)],
                  ].map(([l, v]) => <MetricCard key={l as string} label={l as string} value={v as string} />)}
                </div>
                <Panel title="Coefficient Table">
                  <DataTable
                    headers={['Variable', 'Coeff', 'Std Error', 't-Stat', 'p-Value', '95% CI']}
                    rows={(olsResult.feature_names as string[]).map(name => {
                      const coefs = olsResult.coefficients as Record<string, number>
                      const ses = olsResult.std_errors as Record<string, number>
                      const ts = olsResult.t_stats as Record<string, number>
                      const ps = olsResult.p_values as Record<string, number>
                      const ci = olsResult.conf_intervals as Record<string, number[]>
                      return [
                        name,
                        coefs[name]?.toFixed(6),
                        ses[name]?.toFixed(6),
                        ts[name]?.toFixed(4),
                        ps[name]?.toFixed(4),
                        `[${ci[name]?.[0]?.toFixed(4)}, ${ci[name]?.[1]?.toFixed(4)}]`,
                      ]
                    })}
                  />
                </Panel>
                {diagResult && (
                  <Panel title="Regression Diagnostics">
                    <div className="space-y-3">
                      {[
                        { name: 'Breusch-Pagan (Heteroskedasticity)', test: (diagResult.breusch_pagan as Record<string, unknown>) },
                        { name: 'Durbin-Watson (Serial Correlation)', test: (diagResult.durbin_watson as Record<string, unknown>) },
                        { name: 'Breusch-Godfrey (Serial Correlation)', test: (diagResult.breusch_godfrey as Record<string, unknown>) },
                      ].map(({ name, test }) => (
                        <div key={name} className="p-3 border border-[#1e2635] rounded">
                          <div className="text-xs font-medium text-slate-300 mb-1">{name}</div>
                          <div className="text-xs text-slate-500">{test?.interpretation as string}</div>
                          <div className="flex gap-4 mt-1 text-xs font-mono text-slate-400">
                            <span>Stat: {(test?.statistic as number)?.toFixed(4)}</span>
                            {test?.pvalue !== undefined && <span>p-value: {(test?.pvalue as number)?.toFixed(4)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
