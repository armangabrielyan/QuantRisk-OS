import { useState, useEffect } from 'react'
import { Clock, User, Activity, Database, AlertCircle } from 'lucide-react'
import { Panel, SectionHeader, LoadingSpinner, ErrorMessage } from '@/components/ui'
import { api } from '@/services/api'

interface AuditEvent {
  id: number
  timestamp: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  details: any
}

export default function AuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/audit/trail')
      setEvents(res.data)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch audit trail')
      // Fallback to empty if api fails (or no data)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    const act = action.toLowerCase()
    if (act.includes('calculation')) return 'text-indigo-400 bg-indigo-400/10'
    if (act.includes('change') || act.includes('update')) return 'text-amber-400 bg-amber-400/10'
    if (act.includes('report')) return 'text-emerald-400 bg-emerald-400/10'
    if (act.includes('delete')) return 'text-red-400 bg-red-400/10'
    return 'text-slate-400 bg-slate-400/10'
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Audit Trail" subtitle="System-wide activity logging and immutable record of actions." />
      
      {error && <ErrorMessage message={error} onRetry={fetchEvents} />}
      
      <Panel>
        {loading ? (
          <LoadingSpinner message="Loading audit events..." />
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            No audit events found.
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="flex flex-col sm:flex-row gap-4 bg-[#161b27] border border-[#1e2635] p-4 rounded-xl">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[#0f1117] border border-[#1e2635]">
                  <Activity className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-1">
                    <h4 className="text-sm font-semibold text-slate-200">
                      {event.action}
                    </h4>
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {event.user_id || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" /> {event.entity_type} {event.entity_id ? `(${event.entity_id})` : ''}
                    </span>
                  </div>

                  {event.details && (
                    <div className="mt-2 bg-[#0f1117] p-2 rounded text-xs font-mono text-slate-400 overflow-x-auto border border-[#1e2635]">
                      {JSON.stringify(event.details)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
