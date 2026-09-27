// @ts-nocheck
import { useState } from 'react'
import { creditRiskApi, almApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, DataTable, StatusBadge, Tabs,
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { useI18n } from '@/i18n'

type Tab = 'el' | 'merton' | 'alm' | 'liquidity'

interface Exposure { id: number; name: string; pd: number; lgd: number; ead: number }

export default function CreditALM() {
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

  // ALM
  const [almParams, setAlmParams] = useState({ asset_duration: 5.0, liability_duration: 2.5, asset_value: 100_000_000, liability_value: 90_000_000, rate_shock: 0.01 })
  const [almResult, setAlmResult] = useState<Record<string, unknown> | null>(null)

  // Liquidity
  const [liqParams, setLiqParams] = useState({ hqla: 35_000_000, cash_outflows: 40_000_000, cash_inflows: 12_000_000 })
  const [lcrResult, setLcrResult] = useState<Record<string, unknown> | null>(null)
  const [nsfrResult, setNsfrResult] = useState<Record<string, unknown> | null>(null)

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

  async function runALM() {
    setLoading(true); setError(null); setAlmResult(null)
    try {
      const res = await almApi.durationGap(almParams)
      setAlmResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runLiquidity() {
    setLoading(true); setError(null); setLcrResult(null); setNsfrResult(null)
    try {
      const [lcr, nsfr] = await Promise.all([
        almApi.lcr(liqParams),
        almApi.nsfr({
          asf_components: [
            { name: 'Tier 1 Capital', amount: 15_000_000, factor: 1.0 },
            { name: 'Stable Retail Deposits', amount: 50_000_000, factor: 0.95 },
            { name: 'Wholesale Funding >1yr', amount: 20_000_000, factor: 0.50 },
          ],
          rsf_components: [
            { name: 'Level 1 HQLA', amount: 30_000_000, factor: 0.05 },
            { name: 'Performing Loans', amount: 45_000_000, factor: 0.85 },
            { name: 'Other Assets', amount: 10_000_000, factor: 1.00 },
          ],
        })
      ])
      setLcrResult(lcr.data.data)
      setNsfrResult(nsfr.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  const tabs = [
    { key: 'el', label: ca.tabs.el },
    { key: 'merton', label: ca.tabs.merton },
    { key: 'alm', label: ca.tabs.alm },
    { key: 'liquidity', label: ca.tabs.liquidity },
  ]

  const rateShockBps = Math.round(almParams.rate_shock * 10000)

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={ca.title} subtitle={ca.subtitle} />
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

      {/* ── ALM / Duration Gap ──────────────────────────────────────────────── */}
      {activeTab === 'alm' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={ca.alm.title}>
            <div className="space-y-3">
              {[
                { key: 'asset_duration', label: ca.alm.assetDuration },
                { key: 'liability_duration', label: ca.alm.liabDuration },
                { key: 'asset_value', label: ca.alm.totalAssets },
                { key: 'liability_value', label: ca.alm.totalLiabs },
              ].map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.1" value={almParams[key]}
                    onChange={e => setAlmParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))} />
                </FormField>
              ))}
              <FormField label={`${ca.alm.rateShockLabel}: ${rateShockBps} ${ca.alm.bps}`}>
                <input type="range" min={-0.05} max={0.05} step={0.001} value={almParams.rate_shock}
                  onChange={e => setAlmParams(p => ({ ...p, rate_shock: parseFloat(e.target.value) }))}
                  className="w-full accent-emerald-500" />
              </FormField>
              <Button onClick={runALM} disabled={loading} className="w-full">
                {loading ? ca.alm.running : ca.alm.runBtn}
              </Button>
            </div>
          </Panel>

          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={ca.alm.running} />}
            {almResult && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <MetricCard label={ca.alm.durationGap} value={`${(almResult.duration_gap as number).toFixed(3)} yrs`}
                    status={(almResult.duration_gap as number) > 0 ? 'warn' : 'pass'} />
                  <MetricCard label={`${ca.alm.equitySensLabel} (${rateShockBps} ${ca.alm.equitySensNote})`}
                    value={fmtCurrency(almResult.equity_sensitivity as number)} status={(almResult.equity_sensitivity as number) < 0 ? 'fail' : 'pass'} />
                  <MetricCard label={ca.alm.equityPct} value={`${(almResult.equity_sensitivity_pct as number)?.toFixed(2)}%`} />
                </div>
                <Panel title={ca.alm.irrbbTitle}>
                  <DataTable
                    headers={ca.alm.headers}
                    rows={[
                      [ca.alm.rows.durationGap, `${(almResult.duration_gap as number).toFixed(3)} yrs`, ca.alm.rows.formula.dg],
                      [ca.alm.rows.assetDuration, `${(almResult.asset_duration as number).toFixed(2)} yrs`, ca.alm.rows.formula.input],
                      [ca.alm.rows.liabDuration, `${(almResult.liability_duration as number).toFixed(2)} yrs`, ca.alm.rows.formula.input],
                      [ca.alm.rows.leverage, (almResult.leverage_ratio as number).toFixed(3), 'L/A'],
                      [ca.alm.rows.deltaAssets, fmtCurrency(almResult.delta_assets as number), ca.alm.rows.formula.da],
                      [ca.alm.rows.deltaLiabs, fmtCurrency(almResult.delta_liabilities as number), ca.alm.rows.formula.dl],
                      [ca.alm.rows.deltaEquity, fmtCurrency(almResult.delta_equity as number), ca.alm.rows.formula.de],
                    ]}
                  />
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── LCR / NSFR ──────────────────────────────────────────────────────── */}
      {activeTab === 'liquidity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={ca.liquidity.lcrTitle}>
            <div className="space-y-3">
              <FormField label={ca.liquidity.hqla}>
                <Input type="number" step="1000000" value={liqParams.hqla}
                  onChange={e => setLiqParams(p => ({ ...p, hqla: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label={ca.liquidity.outflows} hint={ca.liquidity.outflowsHint}>
                <Input type="number" step="1000000" value={liqParams.cash_outflows}
                  onChange={e => setLiqParams(p => ({ ...p, cash_outflows: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label={ca.liquidity.inflows} hint={ca.liquidity.inflowsHint}>
                <Input type="number" step="1000000" value={liqParams.cash_inflows}
                  onChange={e => setLiqParams(p => ({ ...p, cash_inflows: parseFloat(e.target.value) }))} />
              </FormField>
              <Button onClick={runLiquidity} disabled={loading} className="w-full">
                {loading ? ca.liquidity.running : ca.liquidity.runBtn}
              </Button>
            </div>
          </Panel>

          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={ca.liquidity.running} />}
            {lcrResult && !loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Panel title={ca.liquidity.lcrSection}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-emerald-400">{fmtPct(lcrResult.lcr_pct as number)}</span>
                    <StatusBadge status={(lcrResult.lcr as number) >= 1 ? 'PASS' : 'FAIL'} />
                  </div>
                  <DataTable
                    headers={ca.liquidity.lcrHeaders}
                    rows={[
                      [ca.liquidity.lcrRows.hqla, fmtCurrency(lcrResult.hqla as number)],
                      [ca.liquidity.lcrRows.grossOut, fmtCurrency(lcrResult.gross_outflows as number)],
                      [ca.liquidity.lcrRows.grossIn, fmtCurrency(lcrResult.gross_inflows as number)],
                      [ca.liquidity.lcrRows.inflowCap, fmtCurrency(lcrResult.capped_inflows as number)],
                      [ca.liquidity.lcrRows.netOut, fmtCurrency(lcrResult.net_cash_outflows as number)],
                      [ca.liquidity.lcrRows.lcr, fmtPct(lcrResult.lcr_pct as number)],
                    ]}
                  />
                  <div className="text-xs text-slate-500 mt-2">{lcrResult.interpretation as string}</div>
                </Panel>
                {nsfrResult && (
                  <Panel title={ca.liquidity.nsfrSection}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-2xl font-bold font-mono text-emerald-400">{fmtPct(nsfrResult.nsfr_pct as number)}</span>
                      <StatusBadge status={(nsfrResult.nsfr as number) >= 1 ? 'PASS' : 'FAIL'} />
                    </div>
                    <DataTable
                      headers={ca.liquidity.nsfrHeaders}
                      rows={[
                        [ca.liquidity.nsfrRows.asf, fmtCurrency(nsfrResult.asf as number)],
                        [ca.liquidity.nsfrRows.rsf, fmtCurrency(nsfrResult.rsf as number)],
                        [ca.liquidity.nsfrRows.surplus, fmtCurrency(nsfrResult.surplus_deficit as number)],
                        [ca.liquidity.nsfrRows.nsfr, fmtPct(nsfrResult.nsfr_pct as number)],
                      ]}
                    />
                    <div className="text-xs text-slate-500 mt-2">{nsfrResult.interpretation as string}</div>
                  </Panel>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
