import { useEffect, useState } from 'react'
import { dataApi, marketRiskApi, creditRiskApi, almApi, stressApi } from '@/services/api'
import { MetricCard, Panel, LoadingSpinner, StatusBadge, ErrorMessage } from '@/components/ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity, Shield, Droplets, BookOpen } from 'lucide-react'
import Plot from 'react-plotly.js'

interface DashboardData {
  portfolioValue: number
  var1d99: number
  es1d99: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  expectedLoss: number
  lcr: number
  nsfr: number
  durationGap: number
  stressLoss: number
  stressLossPct: number
  pnlSeries: number[]
  source: string
}

const DEFAULT_DATA: DashboardData = {
  portfolioValue: 10_000_000,
  var1d99: 148_230,
  es1d99: 201_550,
  volatility: 0.1425,
  sharpeRatio: 0.82,
  maxDrawdown: -0.1234,
  expectedLoss: 56_250,
  lcr: 1.38,
  nsfr: 1.12,
  durationGap: 2.75,
  stressLoss: 2_100_000,
  stressLossPct: 21.0,
  pnlSeries: [],
  source: 'OFFLINE SAMPLE DATA',
}

export default function Overview() {
  const [data, setData] = useState<DashboardData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError(null)
    try {
      // Fetch sample SPY returns
      const spyRes = await dataApi.sample('SPY', 252)
      const returns: number[] = spyRes.data.data.returns

      // Compute VaR
      const varRes = await marketRiskApi.parametricVaR({
        returns,
        confidence: 0.99,
        holding_period: 1,
        portfolio_value: 10_000_000,
        distribution: 'normal',
      })
      const varData = varRes.data.data

      // Volatility
      const volRes = await marketRiskApi.volatility({ returns, method: 'ewma', lambda_: 0.94 })
      const volData = volRes.data.data

      // EL
      const elRes = await creditRiskApi.expectedLoss({
        exposures: [
          { name: 'Corporate Loans', pd: 0.025, lgd: 0.45, ead: 5_000_000 },
          { name: 'SME Loans', pd: 0.04, lgd: 0.55, ead: 2_500_000 },
          { name: 'Retail Mortgages', pd: 0.01, lgd: 0.30, ead: 2_500_000 },
        ],
      })

      // LCR
      const lcrRes = await almApi.lcr({
        hqla: 3_500_000,
        cash_outflows: 4_000_000,
        cash_inflows: 1_200_000,
        stress_horizon: 30,
      })

      // Duration Gap
      const dgRes = await almApi.durationGap({
        asset_duration: 5.0,
        liability_duration: 2.5,
        asset_value: 10_000_000,
        liability_value: 9_000_000,
        rate_shock: 0.01,
      })

      // Stress test
      const stressRes = await stressApi.applyPreset({
        scenario_key: '2008_gfc',
        portfolio_value: 10_000_000,
        var_base: varData.var,
        es_base: varData.es,
        vol_base: volData.volatility_annual,
        duration_gap_base: dgRes.data.data.duration_gap,
        lcr_base: lcrRes.data.data.lcr,
      })

      // Compute cumulative returns for chart
      const cumReturns = returns.reduce((acc: number[], r, i) => {
        acc.push(i === 0 ? (1 + r) : acc[i - 1] * (1 + r))
        return acc
      }, [])

      setData({
        portfolioValue: 10_000_000,
        var1d99: varData.var,
        es1d99: varData.es,
        volatility: volData.volatility_annual,
        sharpeRatio: (varData.mu_daily * 252 - 0.02) / volData.volatility_annual,
        maxDrawdown: Math.min(...returns.reduce((acc: number[], r, i) => {
          const cum = i === 0 ? 1 + r : acc[acc.length - 1] * (1 + r)
          acc.push(cum)
          return acc
        }, [])) - 1,
        expectedLoss: elRes.data.data.total_el,
        lcr: lcrRes.data.data.lcr,
        nsfr: 1.12,
        durationGap: dgRes.data.data.duration_gap,
        stressLoss: stressRes.data.data.impact.total_loss,
        stressLossPct: Math.abs(stressRes.data.data.impact.pct_loss),
        pnlSeries: cumReturns,
        source: spyRes.data.data.source,
      })
    } catch (e: unknown) {
      console.error('Dashboard error:', e)
      setError('Using default sample data (backend calculation failed)')
      // Use defaults with precomputed pnl
      const rng = () => (Math.random() - 0.5) * 0.02
      const pnl = Array.from({ length: 252 }, (_, i) =>
        i === 0 ? 1 + rng() : 0
      ).reduce((acc, _, i) => {
        acc.push(i === 0 ? 1 + rng() : acc[i - 1] * (1 + rng()))
        return acc
      }, [] as number[])
      setData(prev => ({ ...prev, pnlSeries: pnl }))
    } finally {
      setLoading(false)
    }
  }

  const varBreach = data.var1d99 > 200_000
  const lcrStatus = data.lcr >= 1.0 ? 'pass' : 'fail'
  const nsfrStatus = data.nsfr >= 1.0 ? 'pass' : 'fail'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Risk Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            QuantRisk OS — Professional Risk Management Workbench
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded border ${
            data.source === 'LIVE DATA'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {data.source}
          </span>
          <button
            onClick={loadDashboard}
            className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1 rounded border border-[#1e2635] hover:border-[#2d3a4f] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <LoadingSpinner message="Loading dashboard..." />
      ) : (
        <>
          {/* Portfolio Value */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Portfolio Value"
              value={fmtCurrency(data.portfolioValue)}
              subValue="10M reference portfolio"
              icon={<Briefcase className="w-4 h-4" />}
            />
            <MetricCard
              label="1-Day 99% VaR"
              value={fmtCurrency(data.var1d99)}
              subValue={`${fmtPct(data.var1d99 / data.portfolioValue * 100, 3)} of portfolio`}
              status={varBreach ? 'fail' : 'pass'}
              icon={<TrendingDown className="w-4 h-4" />}
            />
            <MetricCard
              label="Expected Shortfall"
              value={fmtCurrency(data.es1d99)}
              subValue="99% CVaR"
              status="neutral"
              icon={<Activity className="w-4 h-4" />}
            />
            <MetricCard
              label="Annual Volatility"
              value={fmtPct(data.volatility * 100)}
              subValue="EWMA λ=0.94"
              status="neutral"
            />
          </div>

          {/* Risk Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Sharpe Ratio"
              value={data.sharpeRatio.toFixed(2)}
              subValue="Rf = 2%"
              status={data.sharpeRatio > 0.5 ? 'pass' : data.sharpeRatio > 0 ? 'warn' : 'fail'}
            />
            <MetricCard
              label="Max Drawdown"
              value={fmtPct(data.maxDrawdown * 100)}
              subValue="Trailing 252d"
              status={Math.abs(data.maxDrawdown) < 0.10 ? 'pass' : Math.abs(data.maxDrawdown) < 0.20 ? 'warn' : 'fail'}
            />
            <MetricCard
              label="Expected Loss"
              value={fmtCurrency(data.expectedLoss)}
              subValue="Credit portfolio EL"
            />
            <MetricCard
              label="GFC 2008 Stress"
              value={`-${fmtPct(data.stressLossPct)}`}
              subValue={fmtCurrency(-data.stressLoss)}
              status="fail"
              icon={<AlertTriangle className="w-4 h-4" />}
            />
          </div>

          {/* Liquidity Row */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              label="LCR"
              value={`${(data.lcr * 100).toFixed(1)}%`}
              subValue="Min: 100% (Basel III)"
              status={lcrStatus}
              icon={<Droplets className="w-4 h-4" />}
            />
            <MetricCard
              label="NSFR"
              value={`${(data.nsfr * 100).toFixed(1)}%`}
              subValue="Min: 100% (Basel III)"
              status={nsfrStatus}
            />
            <MetricCard
              label="Duration Gap"
              value={`${data.durationGap.toFixed(2)}y`}
              subValue="Asset-sensitive"
              status={Math.abs(data.durationGap) < 3 ? 'pass' : 'warn'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Cumulative Return */}
            <Panel title="Cumulative Portfolio Return (252 Days)">
              {data.pnlSeries.length > 0 && (
                <Plot
                  data={[{
                    x: Array.from({ length: data.pnlSeries.length }, (_, i) => i + 1),
                    y: data.pnlSeries.map(v => (v - 1) * 100),
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#10b981', width: 2 },
                    fill: 'tozeroy',
                    fillcolor: 'rgba(16,185,129,0.1)',
                    name: 'Portfolio Return %',
                  }]}
                  layout={{
                    paper_bgcolor: '#0f1117',
                    plot_bgcolor: '#0f1117',
                    font: { color: '#94a3b8', size: 11, family: 'JetBrains Mono' },
                    margin: { t: 10, r: 10, b: 40, l: 50 },
                    xaxis: { title: 'Days', gridcolor: '#1e2635', showgrid: true },
                    yaxis: { title: 'Return %', gridcolor: '#1e2635', showgrid: true },
                    showlegend: false,
                    height: 240,
                  }}
                  config={{ displayModeBar: false }}
                  style={{ width: '100%' }}
                />
              )}
            </Panel>

            {/* Risk Metrics Summary */}
            <Panel title="Risk Summary">
              <div className="space-y-3">
                {[
                  ['Portfolio Value', fmtCurrency(data.portfolioValue), ''],
                  ['1-Day 99% VaR', fmtCurrency(data.var1d99), varBreach ? 'BREACH' : 'OK'],
                  ['1-Day 99% ES', fmtCurrency(data.es1d99), ''],
                  ['Annual Vol', fmtPct(data.volatility * 100), ''],
                  ['Sharpe Ratio', data.sharpeRatio.toFixed(3), data.sharpeRatio > 0.5 ? 'GOOD' : 'LOW'],
                  ['Expected Loss', fmtCurrency(data.expectedLoss), ''],
                  ['LCR', `${(data.lcr * 100).toFixed(1)}%`, data.lcr >= 1 ? 'PASS' : 'FAIL'],
                  ['NSFR', `${(data.nsfr * 100).toFixed(1)}%`, data.nsfr >= 1 ? 'PASS' : 'FAIL'],
                  ['Duration Gap', `${data.durationGap.toFixed(2)}y`, ''],
                  ['GFC Stress Loss', fmtCurrency(data.stressLoss), 'HIGH'],
                ].map(([label, value, status]) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-[#1e2635]/50 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-200">{value}</span>
                      {status && (
                        <StatusBadge
                          status={status === 'BREACH' || status === 'FAIL' || status === 'HIGH' ? 'FAIL' :
                                  status === 'OK' || status === 'PASS' || status === 'GOOD' ? 'PASS' : 'WARN'}
                          label={status}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

// Missing import fix
function Briefcase({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}
function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  )
}
