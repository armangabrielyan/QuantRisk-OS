import { useState, useEffect } from 'react'
import { marketRiskApi, dataApi } from '@/services/api'
import { MetricCard, Panel, SectionHeader, LoadingSpinner, StatusBadge, DataTable } from '@/components/ui'
import { fmtCurrency, fmtPct, fmtBps } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Overview() {
  const { t } = useI18n()
  const ov = t.overview
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [chartData, setChartData] = useState<{ day: number; return: number }[]>([])
  const [dataSource, setDataSource] = useState<'live' | 'offline'>('offline')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const dataRes = await dataApi.sample('SPY', 252)
      const returns: number[] = dataRes.data.data.returns
      setDataSource(dataRes.data.data.source ?? 'offline')

      const [varRes, volRes] = await Promise.all([
        marketRiskApi.parametricVaR({ returns, confidence: 0.99, holding_period: 1, portfolio_value: 10_000_000 }),
        marketRiskApi.volatility({ returns, method: 'ewma', lambda_: 0.94 }),
      ])

      const v = varRes.data.data
      const vol = volRes.data.data
      const rf = 0.02
      const mu_annual = (v.mu_daily ?? 0) * 252
      const sharpe = (mu_annual - rf) / (vol.volatility_annual ?? 1)

      // Cumulative return
      let cum = 0
      const cd = returns.map((r, i) => { cum += r * 100; return { day: i + 1, return: parseFloat(cum.toFixed(3)) } })
      setChartData(cd)

      // Max drawdown
      let peak = 0, mdd = 0, runningCum = 0
      for (const r of returns) {
        runningCum += r
        if (runningCum > peak) peak = runningCum
        const dd = peak - runningCum
        if (dd > mdd) mdd = dd
      }

      setMetrics({
        var_99: v.var,
        var_pct: v.var_pct ?? (v.var / 10_000_000 * 100),
        es_99: v.es,
        annual_vol: vol.volatility_annual,
        sharpe,
        max_drawdown: mdd,
        lcr: 1.38,
        nsfr: 1.12,
        duration_gap: 2.75,
        expected_loss: 56250,
      })
    } catch (e) {
      setError(t.overview.usingDefault)
      setMetrics({
        var_99: 148230, var_pct: 1.48, es_99: 201550,
        annual_vol: 0.1425, sharpe: 0.82, max_drawdown: 0.1234,
        lcr: 1.38, nsfr: 1.12, duration_gap: 2.75, expected_loss: 56250,
      })
      const mockData: { day: number; return: number }[] = []
      let cum2 = 0
      for (let i = 0; i < 252; i++) {
        const r = (Math.sin(i * 0.05) * 0.8 + (Math.random() - 0.5) * 1.5)
        cum2 += r
        mockData.push({ day: i + 1, return: parseFloat(cum2.toFixed(2)) })
      }
      setChartData(mockData)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner message={ov.loadingDashboard} />

  const m = metrics
  const riskRows = [
    [ov.var99, fmtCurrency(m.var_99), `${fmtPct(m.var_pct)}`, <StatusBadge status={m.var_pct < 2.0 ? 'PASS' : 'WARN'} />],
    [ov.es, fmtCurrency(m.es_99), '99% CVaR', <StatusBadge status="WARN" />],
    [ov.annualVol, fmtPct(m.annual_vol * 100), 'EWMA', <StatusBadge status={m.annual_vol < 0.20 ? 'PASS' : 'WARN'} />],
    [ov.sharpe, m.sharpe?.toFixed(3), 'Rf=2%', <StatusBadge status={m.sharpe > 0.5 ? 'PASS' : m.sharpe > 0 ? 'WARN' : 'FAIL'} />],
    [ov.maxDrawdown, fmtPct(m.max_drawdown * 100), '252d', <StatusBadge status={m.max_drawdown < 0.10 ? 'PASS' : m.max_drawdown < 0.20 ? 'WARN' : 'FAIL'} />],
    [ov.lcr, fmtPct(m.lcr * 100), 'Basel III', <StatusBadge status={m.lcr >= 1 ? 'PASS' : 'FAIL'} />],
    [ov.nsfr, fmtPct(m.nsfr * 100), 'Basel III', <StatusBadge status={m.nsfr >= 1 ? 'PASS' : 'FAIL'} />],
    [ov.durationGap, `${m.duration_gap?.toFixed(2)} yrs`, 'IRRBB', <StatusBadge status="WARN" />],
    [ov.expectedLoss, fmtCurrency(m.expected_loss), 'Credit EL', <StatusBadge status="WARN" />],
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={ov.title} subtitle={ov.subtitle}>
        <StatusBadge status={dataSource === 'live' ? 'PASS' : 'WARN'} label={dataSource === 'live' ? t.status.live : t.status.offline} />
      </SectionHeader>

      {error && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Key metrics — 2 cols on mobile, 4 on md+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        <MetricCard
          label={ov.portfolioValue}
          value={fmtCurrency(10_000_000)}
          subValue={ov.portfolioRef}
        />
        <MetricCard
          label={ov.var99}
          value={fmtCurrency(m.var_99)}
          subValue={`${fmtPct(m.var_pct)} ${ov.varSubtext}`}
          status={m.var_pct < 2.0 ? 'pass' : 'warn'}
        />
        <MetricCard
          label={ov.annualVol}
          value={fmtPct(m.annual_vol * 100)}
          subValue={ov.ewmaLabel}
        />
        <MetricCard
          label={ov.sharpe}
          value={m.sharpe?.toFixed(3)}
          subValue={ov.sharpeRf}
          status={m.sharpe > 0.5 ? 'pass' : m.sharpe > 0 ? 'warn' : 'fail'}
        />
        <MetricCard
          label={ov.lcr}
          value={fmtPct(m.lcr * 100)}
          subValue={ov.lcrMin}
          status={m.lcr >= 1 ? 'pass' : 'fail'}
        />
      </div>

      {/* Chart + Risk Summary — stacked on mobile, side by side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title={ov.cumulativeReturn} className="lg:col-span-2">
          <div className="h-48 sm:h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2635" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  label={{ value: ov.days, position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  label={{ value: ov.returnPct, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b27', border: '1px solid #1e2635', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  itemStyle={{ color: '#10b981', fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, ov.returnPct]}
                />
                <Line type="monotone" dataKey="return" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={ov.riskSummary}>
          <DataTable
            headers={[ov.metric, ov.value, ov.statusCol]}
            rows={riskRows.map(r => [r[0], `${r[1]} ${r[2]}`, r[3]])}
          />
        </Panel>
      </div>
    </div>
  )
}
