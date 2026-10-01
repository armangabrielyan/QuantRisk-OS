import { useState, useEffect } from 'react'
import { SectionHeader, Panel, MetricCard, ErrorMessage } from '@/components/ui'
import { esgApi } from '@/services/api'

export default function ESGRisk() {
  const [metrics, setMetrics] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    esgApi.getMetrics().then(res => {
      setMetrics(res.data)
    }).catch(e => setError(e.message))
  }, [])

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title="ESG & Climate Risk" subtitle="Carbon Exposure, WACI, Climate Stress" />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total Carbon Exposure" value={metrics.length > 0 ? (metrics[0].carbon_exposure || "0") : "No Data"} status="warn" />
        <MetricCard label="Weighted Average Carbon Intensity (WACI)" value={metrics.length > 0 ? (metrics[0].waci || "0") : "No Data"} />
        <MetricCard label="Transition Risk Score" value={metrics.length > 0 ? (metrics[0].transition_risk_score || "0") : "No Data"} status="fail" />
      </div>
      <Panel title="Climate Stress Scenarios">
        <p className="text-slate-400">Run physical and transition risk shock scenarios on the portfolio.</p>
        <div className="mt-4 p-4 border border-[#1e2635] rounded bg-[#0f1117] text-sm text-slate-300">
          <div>1.5°C Delayed Transition: -8% impact on equity portfolio</div>
          <div className="mt-2">Extreme Weather Event (Physical): -2.5% impact on real estate assets</div>
        </div>
      </Panel>
    </div>
  )
}
