// @ts-nocheck
import { useState } from 'react'
import { econometricsApi, dataApi } from '@/services/api'
import {
  Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Select, Button, DataTable, Tabs,
} from '@/components/ui'
import { useI18n } from '@/i18n'
import Plot from 'react-plotly.js'

type Tab = 'timeSeries' | 'ols'

const SAMPLE_SERIES_SIZE = 200

export default function Econometrics() {
  const { t } = useI18n()
  const ec = t.econometrics
  const [activeTab, setActiveTab] = useState<Tab>('timeSeries')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Time series
  const [adfRegression, setAdfRegression] = useState('c')
  const [nlags, setNlags] = useState(20)
  const [tsResult, setTsResult] = useState<Record<string, unknown> | null>(null)
  const [acfResult, setAcfResult] = useState<Record<string, unknown> | null>(null)

  // OLS
  const [olsResult, setOlsResult] = useState<Record<string, unknown> | null>(null)
  const [diagResult, setDiagResult] = useState<Record<string, unknown> | null>(null)

  async function getSeries(): Promise<number[]> {
    const res = await dataApi.sample('SPY', SAMPLE_SERIES_SIZE)
    return res.data.data.returns
  }

  async function runTimeSeries() {
    setLoading(true); setError(null); setTsResult(null); setAcfResult(null)
    try {
      const series = await getSeries()
      const [ts, acf] = await Promise.all([
        econometricsApi.timeSeries({ series, maxlag: null, regression: adfRegression, nlags }),
        econometricsApi.acfPacf({ series, nlags }),
      ])
      setTsResult(ts.data.data)
      setAcfResult(acf.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runOLS() {
    setLoading(true); setError(null); setOlsResult(null); setDiagResult(null)
    try {
      const returns = await getSeries()
      const y = returns.slice(1)
      const X = returns.slice(0, -1).map(r => [r])
      const [ols, diag] = await Promise.all([
        econometricsApi.ols({ y, X, feature_names: ['lag_return'], add_constant: true }),
        econometricsApi.diagnostics({ y, X }),
      ])
      setOlsResult(ols.data.data)
      setDiagResult(diag.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  const tabs = [
    { key: 'timeSeries', label: ec.tabs.timeSeries },
    { key: 'ols', label: ec.tabs.ols },
  ]

  const statColor = (pv: number) => pv < 0.05 ? '#10b981' : pv < 0.10 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={ec.title} subtitle={ec.subtitle} />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── Time Series Diagnostics ──────────────────────────────────────────── */}
      {activeTab === 'timeSeries' && (
        <div className="space-y-4">
          <Panel title={ec.ts.paramsTitle}>
            <div className="flex flex-wrap gap-3 items-end">
              <FormField label={ec.ts.adfRegression} hint={ec.ts.adfHint} className="flex-1 min-w-[140px]">
                <Select value={adfRegression} onChange={e => setAdfRegression(e.target.value)}>
                  <option value="c">{ec.ts.adfC}</option>
                  <option value="ct">{ec.ts.adfCT}</option>
                  <option value="n">{ec.ts.adfN}</option>
                </Select>
              </FormField>
              <FormField label={`${ec.ts.nlags}: ${nlags}`} className="flex-1 min-w-[140px]">
                <input type="range" min={5} max={40} step={1} value={nlags}
                  onChange={e => setNlags(parseInt(e.target.value))} className="w-full accent-emerald-500" />
              </FormField>
              <Button onClick={runTimeSeries} disabled={loading}>
                {loading ? ec.ts.running : ec.ts.runBtn}
              </Button>
            </div>
          </Panel>

          {loading && <LoadingSpinner message={ec.ts.running} />}

          {tsResult && !loading && (
            <div className="space-y-4">
              {/* ADF results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Panel title={ec.ts.adfTitle}>
                  <DataTable
                    headers={ec.ts.adfHeaders}
                    rows={[
                      [ec.ts.adfStat, (tsResult.adf_result as any).adf_statistic?.toFixed(4)],
                      [ec.ts.pValue, (tsResult.adf_result as any).p_value?.toFixed(4)],
                      [ec.ts.lagsUsed, (tsResult.adf_result as any).used_lag],
                      [ec.ts.cv1, (tsResult.adf_result as any).critical_values?.['1%']?.toFixed(4)],
                      [ec.ts.cv5, (tsResult.adf_result as any).critical_values?.['5%']?.toFixed(4)],
                      [ec.ts.cv10, (tsResult.adf_result as any).critical_values?.['10%']?.toFixed(4)],
                    ]}
                  />
                  <div className="mt-2 text-xs text-slate-400">{(tsResult.adf_result as any).interpretation}</div>
                </Panel>
                <Panel title={t.common.summary}>
                  <DataTable
                    headers={ec.ts.adfHeaders}
                    rows={[
                      [ec.ts.mean, (tsResult.descriptive_stats as any).mean?.toFixed(6)],
                      [ec.ts.stdDev, (tsResult.descriptive_stats as any).std?.toFixed(6)],
                      [ec.ts.skewness, (tsResult.descriptive_stats as any).skewness?.toFixed(4)],
                      [ec.ts.excessKurt, (tsResult.descriptive_stats as any).excess_kurtosis?.toFixed(4)],
                    ]}
                  />
                </Panel>
              </div>

              {/* ACF/PACF charts */}
              {acfResult && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Panel title={ec.ts.acfTitle}>
                    <Plot
                      data={[{
                        x: acfResult.lags,
                        y: acfResult.acf,
                        type: 'bar',
                        marker: { color: '#10b981', opacity: 0.7 },
                        name: 'ACF',
                      }, {
                        x: acfResult.lags,
                        y: (acfResult.acf_confint as number[][]).map((ci: number[], i: number) => ci[1] - (acfResult.acf as number[])[i]),
                        type: 'scatter', mode: 'lines',
                        line: { color: '#ef4444', dash: 'dash' },
                        name: ec.ts.ci95,
                      }]}
                      layout={{
                        paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                        font: { color: '#94a3b8', size: 10 },
                        margin: { t: 10, r: 10, b: 40, l: 45 },
                        xaxis: { title: ec.ts.lag, gridcolor: '#1e2635' },
                        yaxis: { title: ec.ts.correlation, gridcolor: '#1e2635', range: [-1, 1] },
                        height: 220, showlegend: false,
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
                  </Panel>
                  <Panel title={ec.ts.pacfTitle}>
                    <Plot
                      data={[{
                        x: acfResult.lags,
                        y: acfResult.pacf,
                        type: 'bar',
                        marker: { color: '#3b82f6', opacity: 0.7 },
                        name: 'PACF',
                      }]}
                      layout={{
                        paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117',
                        font: { color: '#94a3b8', size: 10 },
                        margin: { t: 10, r: 10, b: 40, l: 45 },
                        xaxis: { title: ec.ts.lag, gridcolor: '#1e2635' },
                        yaxis: { title: ec.ts.correlation, gridcolor: '#1e2635', range: [-1, 1] },
                        height: 220, showlegend: false,
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
                  </Panel>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OLS Regression ──────────────────────────────────────────────────── */}
      {activeTab === 'ols' && (
        <div className="space-y-4">
          <Panel title={ec.ols.paramsTitle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={ec.ols.depY} hint={ec.ols.depYHint}>
                <input value="SPY returns (t)" readOnly
                  className="w-full bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
              </FormField>
              <FormField label={ec.ols.indepX} hint={ec.ols.indepXHint}>
                <input value="SPY returns (t-1)" readOnly
                  className="w-full bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
              </FormField>
            </div>
            <Button onClick={runOLS} disabled={loading} className="mt-3">
              {loading ? ec.ols.running : ec.ols.runBtn}
            </Button>
          </Panel>

          {loading && <LoadingSpinner message={ec.ols.running} />}

          {olsResult && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-[#161b27] border border-[#1e2635] rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500">{ec.ols.rSquared}</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{(olsResult.r_squared as number).toFixed(4)}</div>
                </div>
                <div className="bg-[#161b27] border border-[#1e2635] rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500">{ec.ols.adjR}</div>
                  <div className="text-lg font-bold text-slate-200 font-mono">{(olsResult.adj_r_squared as number).toFixed(4)}</div>
                </div>
                <div className="bg-[#161b27] border border-[#1e2635] rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500">{ec.ols.fStat}</div>
                  <div className="text-lg font-bold text-slate-200 font-mono">{(olsResult.f_statistic as number)?.toFixed(3) ?? '—'}</div>
                </div>
                <div className="bg-[#161b27] border border-[#1e2635] rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500">{ec.ols.obs}</div>
                  <div className="text-lg font-bold text-slate-200 font-mono">{olsResult.n_obs as number}</div>
                </div>
              </div>

              <Panel title={ec.ols.coeffTable}>
                <DataTable
                  headers={ec.ols.coeffHeaders}
                  rows={(olsResult.feature_names as string[]).map((name: string) => [
                    name,
                    (olsResult.coefficients as any)[name]?.toFixed(6),
                    (olsResult.std_errors as any)[name]?.toFixed(6),
                    (olsResult.t_stats as any)[name]?.toFixed(4),
                    (olsResult.p_values as any)[name]?.toFixed(4),
                    `[${(olsResult.conf_intervals as any)[name]?.[0]?.toFixed(4)}, ${(olsResult.conf_intervals as any)[name]?.[1]?.toFixed(4)}]`,
                  ])}
                />
              </Panel>

              {diagResult && (
                <Panel title={ec.ols.diagnosticsTitle}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: ec.ols.bpTest, stat: (diagResult.breusch_pagan as any)?.statistic, pval: (diagResult.breusch_pagan as any)?.p_value },
                      { label: ec.ols.dwTest, stat: (diagResult.durbin_watson as any)?.statistic, pval: null },
                      { label: ec.ols.bgTest, stat: (diagResult.breusch_godfrey as any)?.statistic, pval: (diagResult.breusch_godfrey as any)?.p_value },
                    ].map(({ label, stat, pval }) => (
                      <div key={label} className="bg-[#0f1117] rounded-lg p-3 border border-[#1e2635]">
                        <div className="text-xs text-slate-500 mb-2 leading-tight">{label}</div>
                        <div className="text-sm font-mono">
                          <span className="text-slate-300">{ec.ols.stat}: </span>
                          <span className="text-emerald-400">{stat?.toFixed(4)}</span>
                        </div>
                        {pval !== null && pval !== undefined && (
                          <div className="text-sm font-mono mt-1">
                            <span className="text-slate-300">{ec.ols.pval}: </span>
                            <span style={{ color: statColor(pval) }}>{pval?.toFixed(4)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
