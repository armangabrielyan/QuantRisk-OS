import { MetricCard } from './ui'
import { fmtCurrency, fmtPct } from '@/lib/utils'

export function KPICards({ metrics, ov }: { metrics: Record<string, any>; ov: any }) {
  const m = metrics

  return (
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
  )
}
