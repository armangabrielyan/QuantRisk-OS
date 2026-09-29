import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, Filter, Tag, Activity, Globe, Shield, Search } from 'lucide-react'
import { Panel } from '@/components/ui'
import { api } from '@/services/api'
import { useI18n } from '@/i18n'

interface RiskEvent {
  id: number
  title: string
  description: string
  date: string
  category: string
  impact: string
  tags: string[]
}

const CATEGORIES = ['All', 'Macro', 'Ratings', 'Regulatory', 'Market']

export default function RiskIntelligence() {
  const { t, lang } = useI18n()

  const [events, setEvents] = useState<RiskEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [filter])

  async function fetchEvents() {
    setLoading(true)
    try {
      const url = filter === 'All' ? '/intelligence/events' : `/intelligence/events?category=${filter}`
      const res = await api.get(url)
      setEvents(res.data.data)
    } catch (e) {
      console.error('Failed to load intelligence events', e)
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(search.toLowerCase()) || 
    e.description.toLowerCase().includes(search.toLowerCase())
  )

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high': return 'text-red-400 border-red-400/20 bg-red-400/10'
      case 'medium': return 'text-amber-400 border-amber-400/20 bg-amber-400/10'
      case 'low': return 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10'
      default: return 'text-slate-400 border-slate-400/20 bg-slate-400/10'
    }
  }

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'macro': return <Globe className="w-4 h-4" />
      case 'ratings': return <Activity className="w-4 h-4" />
      case 'regulatory': return <Shield className="w-4 h-4" />
      default: return <Tag className="w-4 h-4" />
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <Globe className="w-8 h-8 text-indigo-400" />
          {t.nav.riskIntel}
        </h1>
        <p className="text-slate-400">
          {lang === 'en' ? 'Macro-events, rating actions, and regulatory changes monitor.' : 'Лента макро-событий, рейтинговых действий и регуляторных изменений.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex bg-[#0f1117] rounded-lg p-1 border border-[#1e2635] overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                filter === cat
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161b27]'
              }`}
            >
              {cat === 'All' ? t.common.all : cat}
            </button>
          ))}
        </div>
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'en' ? 'Search events...' : 'Поиск событий...'}
            className="w-full bg-[#0f1117] border border-[#1e2635] rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400 animate-pulse">{t.common.loading}</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-500">{t.common.noData}</div>
        ) : (
          filteredEvents.map(event => (
            <div key={event.id} className="bg-[#161b27] border border-[#1e2635] rounded-xl p-5 hover:border-indigo-500/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-[#0f1117] border border-[#1e2635] text-slate-300`}>
                    {getCategoryIcon(event.category)}
                  </div>
                  <h3 className="font-bold text-lg text-slate-100">{event.title}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md border ${getImpactColor(event.impact)}`}>
                    Impact: {event.impact}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {event.date}
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                {event.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {event.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-[#0f1117] text-slate-400 text-xs rounded border border-[#1e2635]">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
