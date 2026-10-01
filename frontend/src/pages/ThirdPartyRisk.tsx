import { useState, useEffect } from 'react'
import { SectionHeader, Panel, MetricCard, ErrorMessage } from '@/components/ui'
import { vendorApi } from '@/services/api'

export default function ThirdPartyRisk() {
  const [vendors, setVendors] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    vendorApi.getVendors().then(res => {
      setVendors(res.data)
    }).catch(e => setError(e.message))
  }, [])

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title="Third-Party Risk" subtitle="Vendor Risk, Critical Providers, Dependency Risk" />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Critical Vendors" value={vendors.filter(v => v.criticality === 'High').length.toString()} />
        <MetricCard label="High Risk Dependencies" value={vendors.filter(v => (v.dependency_risk_score || 0) > 80).length.toString()} status="warn" />
        <MetricCard label="Total Vendors" value={vendors.length.toString()} />
      </div>
      <Panel title="Vendor Inventory">
        <div className="overflow-x-auto text-sm">
          <table className="w-full text-left">
            <thead className="text-slate-500 border-b border-[#1e2635]">
              <tr>
                <th className="py-2">Vendor</th>
                <th className="py-2">Criticality</th>
                <th className="py-2">Risk Score</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-[#1e2635]">
              {vendors.length > 0 ? (
                vendors.map((vendor, i) => (
                  <tr key={i}>
                    <td className="py-2">{vendor.name}</td>
                    <td className={`py-2 ${vendor.criticality === 'High' ? 'text-red-400' : 'text-emerald-400'}`}>{vendor.criticality}</td>
                    <td className="py-2">{vendor.dependency_risk_score}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-2 text-center text-slate-500">No vendors found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
