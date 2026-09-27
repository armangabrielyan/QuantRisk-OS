import { useState } from 'react'
import { reportsApi } from '@/services/api'
import {
  Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Input, Button,
} from '@/components/ui'
import { useI18n } from '@/i18n'

type ReportData = {
  portfolio_name: string; portfolio_value: number; var_limit: number
  var_99: number; es_99: number; annual_vol: number; sharpe: number; max_drawdown: number
  expected_loss: number; total_ead: number; weighted_pd: number; weighted_lgd: number
  lcr: number; nsfr: number; duration_gap: number; equity_sensitivity: number
  scenario_name: string; total_stress_loss: number; loss_pct: number; var_change: number; stressed_lcr: number
  analyst_notes: string
}

const DEFAULT: ReportData = {
  portfolio_name: 'Global Multi-Asset Fund',
  portfolio_value: 10_000_000, var_limit: 200_000,
  var_99: 148_230, es_99: 201_550,
  annual_vol: 0.1425, sharpe: 0.82, max_drawdown: -0.1234,
  expected_loss: 56_250, total_ead: 10_000_000, weighted_pd: 0.025, weighted_lgd: 0.45,
  lcr: 1.38, nsfr: 1.12, duration_gap: 2.75, equity_sensitivity: -275_000,
  scenario_name: 'GFC 2008 Analog', total_stress_loss: 4_500_000, loss_pct: 45,
  var_change: 250_000, stressed_lcr: 0.97,
  analyst_notes: '',
}

export default function Reports() {
  const { t } = useI18n()
  const rp = t.reports
  const [data, setData] = useState<ReportData>(DEFAULT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<{ markdown: string; json_report: Record<string, unknown>; generated_at: string } | null>(null)

  const update = (k: keyof ReportData, v: string) =>
    setData(d => ({ ...d, [k]: typeof d[k] === 'number' ? parseFloat(v) || 0 : v }))

  async function generateReport() {
    setLoading(true); setError(null); setReport(null)
    try {
      const res = await reportsApi.riskCommittee({
        portfolio_name: data.portfolio_name, portfolio_value: data.portfolio_value,
        var_limit: data.var_limit, var_99: data.var_99, es_99: data.es_99,
        annual_vol: data.annual_vol, sharpe: data.sharpe, max_drawdown: data.max_drawdown,
        expected_loss: data.expected_loss, total_ead: data.total_ead,
        weighted_pd: data.weighted_pd, weighted_lgd: data.weighted_lgd,
        lcr: data.lcr, nsfr: data.nsfr, duration_gap: data.duration_gap,
        equity_sensitivity: data.equity_sensitivity,
        scenario_name: data.scenario_name, total_stress_loss: data.total_stress_loss,
        loss_pct: data.loss_pct, var_change: data.var_change, stressed_lcr: data.stressed_lcr,
        analyst_notes: data.analyst_notes,
      })
      setReport(res.data.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Report generation failed') }
    finally { setLoading(false) }
  }

  function downloadMarkdown() {
    if (!report) return
    const blob = new Blob([report.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'risk_report.md'; a.click()
    URL.revokeObjectURL(url)
  }
  function downloadJSON() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report.json_report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'risk_report.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const varBreach = data.var_99 > data.var_limit

  const fieldGroups = [
    {
      title: rp.portfolioSection,
      fields: [
        { key: 'portfolio_name', label: rp.fields.portName, type: 'text' },
        { key: 'portfolio_value', label: rp.fields.portValue, type: 'number' },
        { key: 'var_limit', label: rp.fields.varLimit, type: 'number' },
      ],
    },
    {
      title: rp.marketSection,
      fields: [
        { key: 'var_99', label: rp.fields.var99, type: 'number' },
        { key: 'es_99', label: rp.fields.es99, type: 'number' },
        { key: 'annual_vol', label: rp.fields.annVol, type: 'number' },
        { key: 'sharpe', label: rp.fields.sharpe, type: 'number' },
        { key: 'max_drawdown', label: rp.fields.mdd, type: 'number' },
      ],
    },
    {
      title: rp.creditSection,
      fields: [
        { key: 'expected_loss', label: rp.fields.el, type: 'number' },
        { key: 'total_ead', label: rp.fields.ead, type: 'number' },
        { key: 'weighted_pd', label: rp.fields.pd, type: 'number' },
        { key: 'weighted_lgd', label: rp.fields.lgd, type: 'number' },
      ],
    },
    {
      title: rp.almSection,
      fields: [
        { key: 'lcr', label: rp.fields.lcr, type: 'number' },
        { key: 'nsfr', label: rp.fields.nsfr, type: 'number' },
        { key: 'duration_gap', label: rp.fields.dg, type: 'number' },
        { key: 'equity_sensitivity', label: rp.fields.es_, type: 'number' },
      ],
    },
    {
      title: rp.stressSection,
      fields: [
        { key: 'scenario_name', label: rp.fields.scenarioName, type: 'text' },
        { key: 'total_stress_loss', label: rp.fields.totalLoss, type: 'number' },
        { key: 'loss_pct', label: rp.fields.lossPct, type: 'number' },
        { key: 'var_change', label: rp.fields.varChange, type: 'number' },
        { key: 'stressed_lcr', label: rp.fields.lcrStressed, type: 'number' },
      ],
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={rp.title} subtitle={rp.subtitle}>
        <Button variant="secondary" size="sm" onClick={() => setData(DEFAULT)}>
          {rp.autoPopulate}
        </Button>
      </SectionHeader>
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}
      {varBreach && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {rp.varBreachWarning}
        </div>
      )}

      {/* ── Input Sections ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {fieldGroups.map(group => (
          <Panel key={group.title} title={group.title}>
            <div className="space-y-3">
              {group.fields.map(({ key, label, type }) => (
                <FormField key={key} label={label}>
                  <Input
                    type={type}
                    step="any"
                    value={data[key as keyof ReportData] as string | number}
                    onChange={e => update(key as keyof ReportData, e.target.value)}
                  />
                </FormField>
              ))}
            </div>
          </Panel>
        ))}

        <Panel title={rp.notesSection} className="lg:col-span-2">
          <textarea
            value={data.analyst_notes}
            onChange={e => update('analyst_notes', e.target.value)}
            placeholder={rp.fields.notes}
            rows={4}
            className="w-full bg-[#0f1117] border border-[#1e2635] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 resize-none"
          />
        </Panel>
      </div>

      <Button onClick={generateReport} disabled={loading} size="lg" className="w-full sm:w-auto">
        {loading ? rp.generating : rp.generateBtn}
      </Button>

      {loading && <LoadingSpinner message={rp.generating} />}

      {/* ── Report Preview ─────────────────────────────────────────────────── */}
      {report && !loading && (
        <Panel title={rp.previewTitle}>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-emerald-400 font-medium">{rp.generated} — {new Date(report.generated_at).toLocaleString()}</span>
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" size="sm" onClick={downloadMarkdown}>⬇ {rp.downloadMd}</Button>
              <Button variant="secondary" size="sm" onClick={downloadJSON}>⬇ {rp.downloadJson}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <pre className="text-xs text-slate-300 leading-relaxed bg-[#0f1117] rounded-lg p-4 whitespace-pre-wrap font-mono min-w-0 overflow-x-auto">
              {report.markdown}
            </pre>
          </div>
        </Panel>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-4">📋</div>
          <div className="text-sm font-medium text-slate-400">{rp.emptyTitle}</div>
          <div className="text-xs text-slate-600 mt-1">{rp.emptySubtitle}</div>
        </div>
      )}
    </div>
  )
}
