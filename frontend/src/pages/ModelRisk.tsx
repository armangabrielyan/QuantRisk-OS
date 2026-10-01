import { useState, useEffect } from 'react'
import { SectionHeader, Panel, MetricCard, ErrorMessage } from '@/components/ui'
import { mrmApi } from '@/services/api'

export default function ModelRisk() {
  const [models, setModels] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mrmApi.getModels().then(res => {
      setModels(res.data)
    }).catch(e => setError(e.message))
  }, [])

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title="Model Risk Management" subtitle="Model Registry, Validation, Backtesting" />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Total Models" value={models.length.toString()} />
        <MetricCard label="In Development" value={models.filter(m => m.status === 'DEVELOPMENT').length.toString()} />
        <MetricCard label="Under Validation" value={models.filter(m => m.status === 'VALIDATION').length.toString()} status="warn" />
        <MetricCard label="Approved" value={models.filter(m => m.status === 'APPROVED').length.toString()} status="pass" />
      </div>
      <Panel title="Model Inventory">
        <div className="overflow-x-auto text-sm">
          <table className="w-full text-left">
            <thead className="text-slate-500 border-b border-[#1e2635]">
              <tr>
                <th className="py-2">Model Name</th>
                <th className="py-2">Version</th>
                <th className="py-2">Status</th>
                <th className="py-2">Approval Workflow</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-[#1e2635]">
              {models.length > 0 ? (
                models.map((model, i) => (
                  <tr key={i}>
                    <td className="py-2">{model.model_name}</td>
                    <td className="py-2">{model.version}</td>
                    <td className={`py-2 ${model.status === 'APPROVED' ? 'text-emerald-400' : (model.status === 'VALIDATION' ? 'text-amber-400' : '')}`}>{model.status}</td>
                    <td className="py-2">{model.approval_workflow_status || 'Pending'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-2 text-center text-slate-500">No models found in registry.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
