// @ts-nocheck
import { useState } from 'react'
import { creditRiskApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, DataTable, StatusBadge, Tabs,
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { useI18n } from '@/i18n'
import Plot from 'react-plotly.js'

type Tab = 'el' | 'merton' | 'alm' | 'liquidity' | 'cva' | 'scoring' | 'migration' | 'yieldCurve' | 'bondSens'

interface Exposure { id: number; name: string; pd: number; lgd: number; ead: number }

export default function CreditRisk() {
  const { t } = useI18n()
  const ca = t.creditAlm

  const [activeTab, setActiveTab] = useState<Tab>('el')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // EL
  const [exposures, setExposures] = useState<Exposure[]>([
    { id: 1, name: 'Corporate Bond', pd: 0.025, lgd: 0.45, ead: 5_000_000 },
    { id: 2, name: 'SME Loan', pd: 0.04, lgd: 0.55, ead: 2_500_000 },
    { id: 3, name: 'Retail Mortgage', pd: 0.01, lgd: 0.30, ead: 2_500_000 },
  ])
  const [elResult, setElResult] = useState<Record<string, unknown> | null>(null)

  // Merton
  const [mertonParams, setMertonParams] = useState({ asset_value: 120, asset_volatility: 0.18, debt: 100, maturity: 1.0, risk_free_rate: 0.04 })
  const [mertonResult, setMertonResult] = useState<Record<string, unknown> | null>(null)

  

  

  const [cvaPd, setCvaPd] = useState(0.02)
  const [cvaLgd, setCvaLgd] = useState(0.4)
  const [cvaResult, setCvaResult] = useState<Record<string, unknown> | null>(null)

  const [scoringYTrue, setScoringYTrue] = useState('0, 1, 1, 0, 1')
  const [scoringYProb, setScoringYProb] = useState('0.1, 0.8, 0.9, 0.2, 0.7')
  const [scoringResult, setScoringResult] = useState<Record<string, unknown> | null>(null)

  const [migrationRatings, setMigrationRatings] = useState('AAA, AA, A, BBB')
  const [migrationResult, setMigrationResult] = useState<Record<string, unknown> | null>(null)

  

  


  const addExposure = () => setExposures(p => [...p, { id: Date.now(), name: `Exposure ${p.length + 1}`, pd: 0.02, lgd: 0.45, ead: 1_000_000 }])
  const removeExposure = (id: number) => setExposures(p => p.filter(e => e.id !== id))
  const updateExposure = (id: number, field: keyof Exposure, val: string) =>
    setExposures(p => p.map(e => e.id === id ? { ...e, [field]: field === 'name' ? val : parseFloat(val) || 0 } : e))

  async function runEL() {
    setLoading(true); setError(null); setElResult(null)
    try {
      const res = await creditRiskApi.expectedLoss({
        exposures: exposures.map(e => ({ name: e.name, pd: e.pd, lgd: e.lgd, ead: e.ead }))
      })
      setElResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runMerton() {
    setLoading(true); setError(null); setMertonResult(null)
    try {
      const res = await creditRiskApi.mertonModel(mertonParams)
      setMertonResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  

  

  async function runCVA() {
    setLoading(true); setError(null); setCvaResult(null)
    try {
      const mtm = Array(10).fill(0).map(() => {
        let v = 100
        return Array(20).fill(0).map(() => { v += (Math.random() - 0.5) * 10; return Math.max(0, v) })
      })
      const res = await creditRiskApi.pfeCva({ mtm_simulations: mtm, pd: cvaPd, lgd: cvaLgd })
      setCvaResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runScoring() {
    setLoading(true); setError(null); setScoringResult(null)
    try {
      const res = await creditRiskApi.scoringAdvMetrics({
        y_true: scoringYTrue.split(',').map(s => parseInt(s.trim())),
        y_prob: scoringYProb.split(',').map(s => parseFloat(s.trim()))
      })
      setScoringResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runMigration() {
    setLoading(true); setError(null); setMigrationResult(null)
    try {
      const res = await creditRiskApi.transitionMatrix({
        current_ratings: migrationRatings.split(',').map(s => s.trim()),
        transition_matrix: {
          "AAA": {"AAA":0.9, "AA":0.1},
          "AA": {"AAA":0.05, "AA":0.8, "A":0.15},
          "A": {"AA":0.1, "A":0.8, "BBB":0.1},
          "BBB": {"A":0.15, "BBB":0.8, "Default":0.05}
        }
      })
      setMigrationResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  

  

  const tabs = [
    { key: 'el', label: ca.tabs.el },
    { key: 'merton', label: ca.tabs.merton },
    { key: 'cva', label: t.newFeatures.counterpartyRisk },
    { key: 'scoring', label: t.newFeatures.scoringMetrics },
    { key: 'migration', label: t.newFeatures.ratingMigration },
  ]



  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={t.nav.creditRisk} subtitle={ca.subtitle} />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── Expected Loss ───────────────────────────────────────────────────── */}
      {activeTab === 'el' && (
        <div className="space-y-4">
          <Panel title={ca.el.title}>
            {/* Mobile: hide non-essential columns; show in grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#1e2635]">
                    {[ca.el.colName, ca.el.colPD, ca.el.colLGD, ca.el.colEAD, ca.el.colAction].map((h, i) => (
                      <th key={i} className="text-left text-xs text-slate-500 uppercase pb-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exposures.map(exp => (
                    <tr key={exp.id} className="border-b border-[#1e2635]/50">
                      <td className="py-2 pr-3">
                        <input value={exp.name} onChange={e => updateExposure(exp.id, 'name', e.target.value)}
                          className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-full min-w-[100px]" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" step="0.001" min="0" max="1" value={exp.pd}
                          onChange={e => updateExposure(exp.id, 'pd', e.target.value)}
                          className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-20" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" step="0.01" min="0" max="1" value={exp.lgd}
                          onChange={e => updateExposure(exp.id, 'lgd', e.target.value)}
                          className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-20" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" step="100000" value={exp.ead}
                          onChange={e => updateExposure(exp.id, 'ead', e.target.value)}
                          className="bg-[#0f1117] border border-[#1e2635] rounded px-2 py-1 text-xs text-slate-200 w-28" />
                      </td>
                      <td className="py-2">
                        <Button variant="danger" size="sm" onClick={() => removeExposure(exp.id)}>×</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={addExposure}>{ca.el.addBtn}</Button>
              <Button onClick={runEL} disabled={loading}>{loading ? ca.el.running : ca.el.runBtn}</Button>
            </div>
          </Panel>

          {loading && <LoadingSpinner message={ca.el.running} />}
          {elResult && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <MetricCard label={ca.el.totalEL} value={fmtCurrency(elResult.total_el as number)} status="warn" />
                <MetricCard label={ca.el.totalEAD} value={fmtCurrency(elResult.total_ead as number)} />
                <MetricCard label={ca.el.elEADRatio} value={fmtPct((elResult.total_el as number) / (elResult.total_ead as number) * 100)}
                  subValue={ca.el.portfolioAvg} status="warn" />
              </div>
              <Panel title={ca.el.breakdown}>
                <DataTable
                  headers={ca.el.headers}
                  rows={(elResult.exposures as any[]).map(e => [
                    e.name,
                    fmtPct(e.pd * 100),
                    fmtPct(e.lgd * 100),
                    fmtCurrency(e.ead),
                    fmtCurrency(e.expected_loss),
                    fmtPct((e.expected_loss / (elResult.total_ead as number)) * 100),
                  ])}
                />
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ── Merton Model ─────────────────────────────────────────────────────── */}
      {activeTab === 'merton' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={ca.merton.title}>
            <div className="space-y-3">
              {[
                { key: 'asset_value', label: ca.merton.assetValue },
                { key: 'asset_volatility', label: ca.merton.assetVol },
                { key: 'debt', label: ca.merton.debt },
                { key: 'maturity', label: ca.merton.maturity },
                { key: 'risk_free_rate', label: ca.merton.riskFreeRate },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.01" value={mertonParams[key]}
                    onChange={e => setMertonParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))} />
                </FormField>
              ))}
              <Button onClick={runMerton} disabled={loading} className="w-full">
                {loading ? ca.merton.running : ca.merton.runBtn}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={ca.merton.running} />}
            {mertonResult && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <MetricCard label={ca.merton.dd} value={(mertonResult.distance_to_default as number).toFixed(3)} subValue={ca.merton.ddNote} status={(mertonResult.distance_to_default as number) > 2 ? 'pass' : 'fail'} />
                  <MetricCard label={ca.merton.pd} value={fmtPct((mertonResult.pd as number) * 100)} status={(mertonResult.pd as number) < 0.05 ? 'pass' : 'fail'} />
                  <MetricCard label={ca.merton.equityValue} value={fmtCurrency((mertonResult.equity_value as number) * 1_000_000)} />
                </div>
                <Panel title={ca.merton.results}>
                  <DataTable
                    headers={ca.merton.headers}
                    rows={[
                      [ca.merton.rows.assetValue, fmtCurrency(mertonParams.asset_value * 1e6), ca.merton.rows.currentFirmValue],
                      [ca.merton.rows.debtPV, fmtCurrency(mertonParams.debt * Math.exp(-mertonParams.risk_free_rate * mertonParams.maturity) * 1e6), ca.merton.rows.pvDebt],
                      [ca.merton.rows.equityValue, fmtCurrency((mertonResult.equity_value as number) * 1e6), ca.merton.rows.maxEquity],
                      [ca.merton.rows.leverage, (mertonParams.debt / mertonParams.asset_value).toFixed(3), ca.merton.rows.higherRisk],
                      [ca.merton.rows.d1, (mertonResult.d1 as number)?.toFixed(4) ?? '—', ca.merton.rows.bsmD1],
                      [ca.merton.rows.d2, (mertonResult.distance_to_default as number).toFixed(4), ca.merton.rows.distToDefault],
                      [ca.merton.rows.pd, fmtPct((mertonResult.pd as number) * 100), ca.merton.rows.nd2],
                    ]}
                  />
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CVA ───────────────────────────────────────────────────────────── */}
      {activeTab === 'cva' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.metrics.pd}>
                <Input type="number" step="0.01" value={cvaPd} onChange={e => setCvaPd(parseFloat(e.target.value))} />
              </FormField>
              <FormField label={t.metrics.lgd}>
                <Input type="number" step="0.01" value={cvaLgd} onChange={e => setCvaLgd(parseFloat(e.target.value))} />
              </FormField>
              <Button onClick={runCVA} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {cvaResult && !loading && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label={t.newFeatures.epe} value={fmtCurrency(cvaResult.epe as number)} />
                  <MetricCard label={t.newFeatures.cva} value={fmtCurrency(cvaResult.cva as number)} status="fail" />
                </div>
                <Panel title="Profiles">
                  <Plot
                    data={[
                      { y: cvaResult.ee_profile as number[], type: 'scatter', mode: 'lines', name: 'EE' },
                      { y: cvaResult.pfe_95_profile as number[], type: 'scatter', mode: 'lines', name: 'PFE 95%' }
                    ]}
                    layout={{ paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117', font: { color: '#94a3b8' }, height: 250, margin: { t:10, b:30, l:40, r:10 } }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: '100%' }}
                  />
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Scoring ───────────────────────────────────────────────────────── */}
      {activeTab === 'scoring' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.yTrue}>
                <Input value={scoringYTrue} onChange={e => setScoringYTrue(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.yProb}>
                <Input value={scoringYProb} onChange={e => setScoringYProb(e.target.value)} />
              </FormField>
              <Button onClick={runScoring} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {scoringResult && !loading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <MetricCard label={t.newFeatures.rocAuc} value={(scoringResult.roc_auc as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.gini} value={(scoringResult.gini as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.ksStat} value={(scoringResult.ks_stat as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.ksInterpretation} value={scoringResult.ks_interpretation as string} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Migration ─────────────────────────────────────────────────────── */}
      {activeTab === 'migration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.currentRatings}>
                <Input value={migrationRatings} onChange={e => setMigrationRatings(e.target.value)} />
              </FormField>
              <Button onClick={runMigration} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {migrationResult && !loading && (
              <Panel title={t.newFeatures.expectedFutureDist}>
                <pre className="text-xs text-slate-300 bg-[#0a0a0f] p-4 rounded overflow-auto">
                  {JSON.stringify(migrationResult.expected_future_distribution, null, 2)}
                </pre>
              </Panel>
            )}
          </div>
        </div>
      )}

          </div>
  )
}
