import { useState } from 'react'
import { opRiskApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button, Tabs,
} from '@/components/ui'
import { fmtCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'

type Tab = 'sma'

export default function OperationalRisk() {
  const { t } = useI18n()
  
  const [activeTab, setActiveTab] = useState<Tab>('sma')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={t.nav.opRisk} subtitle="Basel III Operational Risk Capital Framework" />
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as Tab); setError(null) }} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

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
