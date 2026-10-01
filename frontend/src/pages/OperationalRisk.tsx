import { useState } from 'react'
import { opRiskApi, opRiskExtendedApi } from '@/services/api'
import { useEffect } from 'react'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, Tabs,
} from '@/components/ui'
import { fmtCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'

type Tab = 'sma' | 'cyber'

export default function OperationalRisk() {
  const { t } = useI18n()
  
  const [activeTab, setActiveTab] = useState<Tab>('sma')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [incidents, setIncidents] = useState<any[]>([])
  
  useEffect(() => {
    if (activeTab === 'cyber') {
      opRiskExtendedApi.getIncidents().then(res => setIncidents(res.data)).catch(e => setError(e.message))
    }
  }, [activeTab])


  // SMA Capital state
  const [bic, setBic] = useState(5000000)
  const [ilm, setIlm] = useState(1.2)
  const [smaResult, setSmaResult] = useState<Record<string, unknown> | null>(null)

  async function runSMA() {
    setLoading(true); setError(null); setSmaResult(null)
    try {
      const res = await opRiskApi.sma({ bic, loss_multiplier: ilm })
      setSmaResult(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Calculation failed') }
    finally { setLoading(false) }
  }

  const tabs = [
    { key: 'sma', label: t.newFeatures.baselSma },
    { key: 'cyber', label: 'Cyber & IT Risk' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={t.nav.opRisk} subtitle="Basel III Operational Risk Capital Framework & Cyber Risk" />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

            {activeTab === 'cyber' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 space-y-4">
             <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Active Cyber Incidents" value={incidents.length.toString()} status="warn" />
                <MetricCard label="Open Vulnerabilities" value="15" status="fail" />
                <MetricCard label="Service Availability" value="99.98%" status="pass" />
             </div>
             <Panel title="Operational Loss Events (Business Continuity)">
                <div className="text-sm text-slate-300">
                  {incidents.length > 0 ? (
                    incidents.map((inc, i) => (
                      <div key={i}>{inc.incident_type}: {inc.severity}</div>
                    ))
                  ) : "No recent operational loss events recorded."}
                </div>
             </Panel>
          </div>
        </div>
      )}

      {activeTab === 'sma' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t.common.parameters}>
            <div className="space-y-3">
              <FormField label={t.newFeatures.bic}>
                <Input type="number" step="10000" value={bic} onChange={e => setBic(parseFloat(e.target.value))} />
              </FormField>
              <FormField label={t.newFeatures.ilm}>
                <Input type="number" step="0.1" value={ilm} onChange={e => setIlm(parseFloat(e.target.value))} />
              </FormField>
              <Button onClick={runSMA} disabled={loading} className="w-full">
                {loading ? t.common.calculating : t.common.run}
              </Button>
            </div>
          </Panel>
          <div className="lg:col-span-2 space-y-4">
            {loading && <LoadingSpinner message={t.common.calculating} />}
            {smaResult && !loading && (
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label={t.newFeatures.capitalRequirement} value={fmtCurrency(smaResult.capital_requirement as number)} status="fail" />
                <MetricCard label={t.newFeatures.interpretation} value={smaResult.interpretation as string} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
