import { useState } from 'react'
import { creditRiskApi, almApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Select, Button, DataTable, StatusBadge
} from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import Plot from 'react-plotly.js'

type ActiveTab = 'el' | 'merton' | 'alm' | 'liquidity'

interface Exposure { name: string; pd: number; lgd: number; ead: number }

export default function CreditALM() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('el')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // EL state
  const [exposures, setExposures] = useState<Exposure[]>([
    { name: 'Corporate Loans', pd: 0.025, lgd: 0.45, ead: 5_000_000 },
    { name: 'SME Loans', pd: 0.04, lgd: 0.55, ead: 2_500_000 },
    { name: 'Retail Mortgages', pd: 0.01, lgd: 0.30, ead: 2_500_000 },
  ])
  const [elResult, setElResult] = useState<Record<string, unknown> | null>(null)

  // Merton state
  const [merton, setMerton] = useState({ asset_value: 120, asset_volatility: 0.18, debt: 100, maturity: 1.0, risk_free_rate: 0.04 })
  const [mertonResult, setMertonResult] = useState<Record<string, unknown> | null>(null)

  // ALM state
  const [almParams, setAlmParams] = useState({ asset_duration: 5.0, liability_duration: 2.5, asset_value: 1_000_000_000, liability_value: 900_000_000, rate_shock: 0.01 })
  const [almResult, setAlmResult] = useState<Record<string, unknown> | null>(null)

  // LCR state
  const [lcrParams, setLcrParams] = useState({ hqla: 3_500_000, cash_outflows: 4_000_000, cash_inflows: 1_200_000, stress_horizon: 30 })
  const [lcrResult, setLcrResult] = useState<Record<string, unknown> | null>(null)

  // NSFR state
  const [nsfrResult, setNsfrResult] = useState<Record<string, unknown> | null>(null)

  async function runEL() {
    setLoading(true); setError(null); setElResult(null)
    try {
      const res = await creditRiskApi.expectedLoss({ exposures })
      setElResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  async function runMerton() {
    setLoading(true); setError(null); setMertonResult(null)
    try {
      const res = await creditRiskApi.mertonModel(merton)
      setMertonResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  async function runALM() {
    setLoading(true); setError(null); setAlmResult(null)
    try {
      const res = await almApi.durationGap(almParams)
      setAlmResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  async function runLiquidity() {
    setLoading(true); setError(null); setLcrResult(null); setNsfrResult(null)
    try {
      const [lcr, nsfr] = await Promise.all([
        almApi.lcr(lcrParams),
        almApi.nsfr({
          asf_components: [
            { name: 'Tier 1 Capital', amount: 1_000_000_000, factor: 1.0 },
            { name: 'Stable Retail Deposits', amount: 3_000_000_000, factor: 0.95 },
            { name: 'Less Stable Deposits', amount: 1_500_000_000, factor: 0.90 },
            { name: 'Wholesale Funding > 1yr', amount: 500_000_000, factor: 1.0 },
          ],
          rsf_components: [
            { name: 'HQLA Level 1', amount: 1_200_000_000, factor: 0.0 },
            { name: 'Performing Loans > 1yr', amount: 4_000_000_000, factor: 0.65 },
            { name: 'SME Loans', amount: 800_000_000, factor: 0.85 },
            { name: 'Securities', amount: 600_000_000, factor: 0.50 },
          ],
        }),
      ])
      setLcrResult(lcr.data.data)
      setNsfrResult(nsfr.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  const updateExposure = (idx: number, field: keyof Exposure, val: string | number) => {
    setExposures(prev => prev.map((e, i) => i === idx ? { ...e, [field]: typeof val === 'string' ? val : parseFloat(String(val)) } : e))
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Credit Risk & ALM" subtitle="Expected Loss, Merton Model, Duration Gap, LCR, NSFR" />

      <div className="flex gap-1 border-b border-[#1e2635]">
        {(['el', 'merton', 'alm', 'liquidity'] as ActiveTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {tab === 'el' ? 'Expected Loss' : tab === 'merton' ? 'Merton Model' : tab === 'alm' ? 'Duration Gap' : 'LCR / NSFR'}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      {/* EL Tab */}
      {activeTab === 'el' && (
        <div className="space-y-4">
          <Panel title="Exposure Portfolio">
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2 text-xs text-slate-500 pb-2 border-b border-[#1e2635]">
                <span>Name</span><span>PD</span><span>LGD</span><span>EAD ($)</span><span>Action</span>
              </div>
              {exposures.map((exp, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <Input value={exp.name} onChange={e => updateExposure(i, 'name', e.target.value)} />
                  <Input type="number" step="0.001" value={exp.pd} onChange={e => updateExposure(i, 'pd', e.target.value)} />
                  <Input type="number" step="0.01" value={exp.lgd} onChange={e => updateExposure(i, 'lgd', e.target.value)} />
                  <Input type="number" value={exp.ead} onChange={e => updateExposure(i, 'ead', e.target.value)} />
                  <Button variant="danger" size="sm" onClick={() => setExposures(prev => prev.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Button variant="secondary" size="sm" onClick={() => setExposures(prev => [...prev, { name: `Exposure ${prev.length + 1}`, pd: 0.02, lgd: 0.45, ead: 1_000_000 }])}>
                  + Add Exposure
                </Button>
                <Button onClick={runEL} disabled={loading} size="sm">
                  {loading ? 'Computing...' : 'Compute EL = PD × LGD × EAD'}
                </Button>
              </div>
            </div>
          </Panel>

          {loading && <LoadingSpinner />}
          {elResult && !loading && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="Total Expected Loss" value={fmtCurrency(elResult.total_el as number)} status="neutral" />
                <MetricCard label="Total EAD" value={fmtCurrency(elResult.total_ead as number)} />
                <MetricCard label="EL / EAD" value={fmtPct(elResult.total_el_pct as number, 3)} subValue="Portfolio average" />
                <MetricCard label="Wtd Avg PD" value={fmtPct((elResult.weighted_avg_pd as number) * 100, 3)} />
              </div>
              <Panel title="Exposure Breakdown">
                <DataTable
                  headers={['Name', 'PD', 'LGD', 'EAD', 'Expected Loss', 'EL%']}
                  rows={(elResult.exposures as Exposure[]).map(e => [
                    e.name,
                    fmtPct((e.pd) * 100, 2),
                    fmtPct((e.lgd) * 100, 1),
                    fmtCurrency(e.ead),
                    fmtCurrency((e as unknown as Record<string, unknown>).el as number),
                    fmtPct((e as unknown as Record<string, unknown>).el_pct as number, 3),
                  ])}
                />
              </Panel>
            </>
          )}
        </div>
      )}

      {/* Merton Tab */}
      {activeTab === 'merton' && (
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Firm Parameters" className="col-span-1">
            <div className="space-y-4">
              {Object.entries({ asset_value: 'Asset Value (V, $M)', asset_volatility: 'Asset Volatility (σ)', debt: 'Debt Face Value (D, $M)', maturity: 'Debt Maturity (T, yrs)', risk_free_rate: 'Risk-free Rate (r)' }).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <Input type="number" step="0.01" value={merton[key as keyof typeof merton]}
                    onChange={e => setMerton(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))} />
                </FormField>
              ))}
              <Button onClick={runMerton} disabled={loading} className="w-full">
                {loading ? 'Computing...' : 'Run Merton Model'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-2 space-y-4">
            {loading && <LoadingSpinner />}
            {mertonResult && !loading && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Distance to Default" value={(mertonResult.distance_to_default as number).toFixed(3)} subValue="DD = d2 in BSM" />
                  <MetricCard label="Risk-Neutral PD" value={fmtPct((mertonResult.pd as number) * 100, 3)} status={(mertonResult.pd as number) < 0.05 ? 'pass' : (mertonResult.pd as number) < 0.15 ? 'warn' : 'fail'} />
                  <MetricCard label="Equity Value" value={fmtCurrency(mertonResult.equity_value as number)} />
                </div>
                <Panel title="Merton Model Results">
                  <DataTable
                    headers={['Metric', 'Value', 'Interpretation']}
                    rows={[
                      ['Asset Value (V)', fmtCurrency(mertonResult.asset_value as number), 'Current firm value'],
                      ['Debt PV', fmtCurrency(mertonResult.debt_pv as number), 'PV of debt = D·e^(-rT)'],
                      ['Equity Value', fmtCurrency(mertonResult.equity_value as number), 'Max(V-D, 0) analog'],
                      ['Leverage (D/V)', fmtPct((mertonResult.leverage_ratio as number) * 100, 1), 'Higher = more risky'],
                      ['d1', (mertonResult.d1 as number).toFixed(4), 'BSM d1'],
                      ['d2 (DD)', (mertonResult.d2 as number).toFixed(4), 'Distance to Default'],
                      ['Risk-Neutral PD', fmtPct((mertonResult.pd as number) * 100, 4), '= N(-d2)'],
                      ['Implied Credit Spread', `${((mertonResult.implied_credit_spread_bps as number) || 0).toFixed(1)} bps`, 'Annual spread'],
                    ]}
                  />
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* ALM Tab */}
      {activeTab === 'alm' && (
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Balance Sheet" className="col-span-1">
            <div className="space-y-4">
              <FormField label="Asset Duration (years)">
                <Input type="number" step="0.1" value={almParams.asset_duration}
                  onChange={e => setAlmParams(prev => ({ ...prev, asset_duration: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label="Liability Duration (years)">
                <Input type="number" step="0.1" value={almParams.liability_duration}
                  onChange={e => setAlmParams(prev => ({ ...prev, liability_duration: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label="Total Assets ($)">
                <Input type="number" value={almParams.asset_value}
                  onChange={e => setAlmParams(prev => ({ ...prev, asset_value: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label="Total Liabilities ($)">
                <Input type="number" value={almParams.liability_value}
                  onChange={e => setAlmParams(prev => ({ ...prev, liability_value: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label={`Rate Shock: ${(almParams.rate_shock * 10000).toFixed(0)} bps`}>
                <input type="range" min={-0.03} max={0.03} step={0.001} value={almParams.rate_shock}
                  onChange={e => setAlmParams(prev => ({ ...prev, rate_shock: parseFloat(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
              </FormField>
              <Button onClick={runALM} disabled={loading} className="w-full">
                {loading ? 'Computing...' : 'Compute Duration Gap'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-2 space-y-4">
            {loading && <LoadingSpinner />}
            {almResult && !loading && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Duration Gap" value={`${(almResult.duration_gap as number).toFixed(3)} yrs`}
                    status={(almResult.duration_gap as number) > 0 ? 'warn' : 'pass'} />
                  <MetricCard label="Equity Sensitivity" value={fmtCurrency(almResult.equity_sensitivity as number)}
                    subValue={`${(almResult.rate_shock_bps as number).toFixed(0)} bps shock`}
                    status={(almResult.equity_sensitivity as number) < 0 ? 'fail' : 'pass'} />
                  <MetricCard label="ΔEquity %" value={fmtPct(almResult.equity_sensitivity_pct as number, 2)} />
                </div>
                <Panel title="IRRBB Analysis">
                  <DataTable
                    headers={['Metric', 'Value', 'Formula']}
                    rows={[
                      ['Duration Gap', `${(almResult.duration_gap as number).toFixed(4)} yrs`, 'D_A - (L/A)×D_L'],
                      ['Asset Duration', `${(almResult.asset_duration as number).toFixed(2)} yrs`, 'Input'],
                      ['Liability Duration', `${(almResult.liability_duration as number).toFixed(2)} yrs`, 'Input'],
                      ['Leverage (L/A)', `${(almResult.leverage_ratio as number).toFixed(4)}`, 'L/A'],
                      ['ΔAssets', fmtCurrency(almResult.delta_assets as number), '-D_A×A×Δr'],
                      ['ΔLiabilities', fmtCurrency(almResult.delta_liabilities as number), '-D_L×L×Δr'],
                      ['ΔEquity', fmtCurrency(almResult.delta_equity as number), 'ΔA - ΔL'],
                    ]}
                  />
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
                    {almResult.interpretation as string}
                  </div>
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* Liquidity Tab */}
      {activeTab === 'liquidity' && (
        <div className="grid grid-cols-3 gap-4">
          <Panel title="LCR Inputs" className="col-span-1">
            <div className="space-y-4">
              <FormField label="HQLA ($)">
                <Input type="number" value={lcrParams.hqla}
                  onChange={e => setLcrParams(prev => ({ ...prev, hqla: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label="Gross Outflows ($)" hint="30-day stress outflows">
                <Input type="number" value={lcrParams.cash_outflows}
                  onChange={e => setLcrParams(prev => ({ ...prev, cash_outflows: parseFloat(e.target.value) }))} />
              </FormField>
              <FormField label="Gross Inflows ($)" hint="30-day expected inflows">
                <Input type="number" value={lcrParams.cash_inflows}
                  onChange={e => setLcrParams(prev => ({ ...prev, cash_inflows: parseFloat(e.target.value) }))} />
              </FormField>
              <Button onClick={runLiquidity} disabled={loading} className="w-full">
                {loading ? 'Computing...' : 'Compute LCR & NSFR'}
              </Button>
            </div>
          </Panel>

          <div className="col-span-2 space-y-4">
            {loading && <LoadingSpinner />}
            {lcrResult && !loading && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-slate-300">LCR</h3>
                      <StatusBadge status={(lcrResult.status as string)} />
                    </div>
                    <DataTable
                      headers={['Component', 'Value']}
                      rows={[
                        ['HQLA', fmtCurrency(lcrResult.hqla as number)],
                        ['Gross Outflows', fmtCurrency(lcrResult.gross_outflows as number)],
                        ['Gross Inflows', fmtCurrency(lcrResult.gross_inflows as number)],
                        ['Inflow Cap (75%)', fmtCurrency(lcrResult.capped_inflows as number)],
                        ['Net Cash Outflows', fmtCurrency(lcrResult.net_cash_outflows as number)],
                        ['LCR', `${(lcrResult.lcr_pct as number).toFixed(1)}%`],
                      ]}
                    />
                  </div>
                  {nsfrResult && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-sm font-semibold text-slate-300">NSFR</h3>
                        <StatusBadge status={(nsfrResult.status as string)} />
                      </div>
                      <DataTable
                        headers={['Component', 'Value']}
                        rows={[
                          ['Available SF (ASF)', fmtCurrency(nsfrResult.asf as number)],
                          ['Required SF (RSF)', fmtCurrency(nsfrResult.rsf as number)],
                          ['Surplus / Deficit', fmtCurrency(nsfrResult.surplus_deficit as number)],
                          ['NSFR', `${(nsfrResult.nsfr_pct as number).toFixed(1)}%`],
                        ]}
                      />
                    </div>
                  )}
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
                  {lcrResult.interpretation as string}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
