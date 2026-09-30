// @ts-nocheck
import { useState } from 'react'
import { almApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, DataTable, StatusBadge, Tabs,
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { useI18n } from '@/i18n'
import Plot from 'react-plotly.js'

type Tab = 'el' | 'merton' | 'alm' | 'liquidity' | 'cva' | 'scoring' | 'migration' | 'yieldCurve' | 'bondSens'

interface Exposure { id: number; name: string; pd: number; lgd: number; ead: number }

export default function ALMLiquidity() {
  const { t } = useI18n()
  const ca = t.creditAlm

  const [activeTab, setActiveTab] = useState<Tab>('alm')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  

  

  // ALM
  const [almParams, setAlmParams] = useState({ asset_duration: 5.0, liability_duration: 2.5, asset_value: 100_000_000, liability_value: 90_000_000, rate_shock: 0.01 })
  const [almResult, setAlmResult] = useState<Record<string, unknown> | null>(null)

  // Liquidity
  const [liqParams, setLiqParams] = useState({ hqla: 35_000_000, cash_outflows: 40_000_000, cash_inflows: 12_000_000 })
  const [lcrResult, setLcrResult] = useState<Record<string, unknown> | null>(null)
  const [nsfrResult, setNsfrResult] = useState<Record<string, unknown> | null>(null)

  

  

  

  const [ycBeta0, setYcBeta0] = useState(0.03)
  const [ycBeta1, setYcBeta1] = useState(-0.02)
  const [ycBeta2, setYcBeta2] = useState(0.02)
  const [ycBeta3, setYcBeta3] = useState(0.01)
  const [ycTau1, setYcTau1] = useState(1.5)
  const [ycTau2, setYcTau2] = useState(5.0)
  const [ycResult, setYcResult] = useState<Record<string, unknown> | null>(null)

  const [bondCashflows, setBondCashflows] = useState('5, 5, 5, 5, 105')
  const [bondTimes, setBondTimes] = useState('1, 2, 3, 4, 5')
  const [bondYield, setBondYield] = useState(0.04)
  const [bondPrice, setBondPrice] = useState('')
  const [bondResult, setBondResult] = useState<Record<string, unknown> | null>(null)




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

  

  

  

  async function runYieldCurve() {
    setLoading(true); setError(null); setYcResult(null)
    try {
      const res = await almApi.nssYieldCurve({
        maturities: [1,2,3,4,5,7,10,20,30],
        b0: ycBeta0, b1: ycBeta1, b2: ycBeta2, b3: ycBeta3, tau1: ycTau1, tau2: ycTau2
      })
      setYcResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  async function runBondSens() {
    setLoading(true); setError(null); setBondResult(null)
    try {
      const res = await almApi.bondMetrics({
        cashflows: bondCashflows.split(',').map(s => parseFloat(s.trim())),
        times: bondTimes.split(',').map(s => parseFloat(s.trim())),
        yield_rate: bondYield,
        current_price: bondPrice ? parseFloat(bondPrice) : undefined
      })
      setBondResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  const tabs = [
    { key: 'alm', label: ca.tabs.alm },
    { key: 'liquidity', label: ca.tabs.liquidity },
    { key: 'yieldCurve', label: t.newFeatures.yieldCurveAlm },
    { key: 'bondSens', label: t.newFeatures.bondSensitivities },
  ]

  const rateShockBps = Math.round(almParams.rate_shock * 10000)

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={t.nav.almLiquidity} subtitle={ca.subtitle} />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

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

      {/* ── Yield Curve ───────────────────────────────────────────────────── */}
      {activeTab === 'yieldCurve' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3 grid grid-cols-2 gap-2">
              <FormField label="Beta 0"><Input type="number" step="0.01" value={ycBeta0} onChange={e=>setYcBeta0(parseFloat(e.target.value))} /></FormField>
              <FormField label="Beta 1"><Input type="number" step="0.01" value={ycBeta1} onChange={e=>setYcBeta1(parseFloat(e.target.value))} /></FormField>
              <FormField label="Beta 2"><Input type="number" step="0.01" value={ycBeta2} onChange={e=>setYcBeta2(parseFloat(e.target.value))} /></FormField>
              <FormField label="Beta 3"><Input type="number" step="0.01" value={ycBeta3} onChange={e=>setYcBeta3(parseFloat(e.target.value))} /></FormField>
              <FormField label="Tau 1"><Input type="number" step="0.1" value={ycTau1} onChange={e=>setYcTau1(parseFloat(e.target.value))} /></FormField>
              <FormField label="Tau 2"><Input type="number" step="0.1" value={ycTau2} onChange={e=>setYcTau2(parseFloat(e.target.value))} /></FormField>
              <div className="col-span-2">
                <Button onClick={runYieldCurve} disabled={loading} className="w-full">
                  {loading ? t.common.calculating : t.common.run}
                </Button>
              </div>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {ycResult && !loading && (
              <Panel title={t.newFeatures.yieldCurveAlm}>
                <Plot
                  data={[
                    { x: ycResult.maturities as number[], y: ycResult.yields as number[], type: 'scatter', mode: 'lines+markers' }
                  ]}
                  layout={{ paper_bgcolor: '#0f1117', plot_bgcolor: '#0f1117', font: { color: '#94a3b8' }, height: 250, margin: { t:10, b:30, l:40, r:10 } }}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%' }}
                />
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ── Bond Sensitivities ────────────────────────────────────────────── */}
      {activeTab === 'bondSens' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.cashflows}>
                <Input value={bondCashflows} onChange={e => setBondCashflows(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.times}>
                <Input value={bondTimes} onChange={e => setBondTimes(e.target.value)} />
              </FormField>
              <FormField label={t.newFeatures.yieldRate}>
                <Input type="number" step="0.01" value={bondYield} onChange={e => setBondYield(parseFloat(e.target.value))} />
              </FormField>
              <FormField label={t.newFeatures.currentPrice}>
                <Input type="number" value={bondPrice} onChange={e => setBondPrice(e.target.value)} placeholder="Optional" />
              </FormField>
              <Button onClick={runBondSens} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {bondResult && !loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <MetricCard label={t.newFeatures.price} value={fmtCurrency(bondResult.price as number)} />
                <MetricCard label={t.newFeatures.dv01} value={(bondResult.dv01 as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.macDur} value={(bondResult.mac_duration as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.modDur} value={(bondResult.mod_duration as number).toFixed(4)} />
                <MetricCard label={t.newFeatures.convexity} value={(bondResult.convexity as number).toFixed(4)} />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
