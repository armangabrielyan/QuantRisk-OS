import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, CreditCard, BarChart2, Briefcase,
  GraduationCap, AlertTriangle, FileText, ChevronLeft, ChevronRight,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/market-risk', label: 'Market Risk', icon: TrendingUp },
  { to: '/credit-alm', label: 'Credit & ALM', icon: CreditCard },
  { to: '/econometrics', label: 'Econometrics', icon: BarChart2 },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/frm-trainer', label: 'FRM Trainer', icon: GraduationCap },
  { to: '/stress', label: 'Crisis Sandbox', icon: AlertTriangle },
  { to: '/reports', label: 'Reports', icon: FileText },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-[#0d1117] border-r border-[#1e2635] flex flex-col transition-all duration-200 z-40',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1e2635]">
        <div className="w-8 h-8 rounded-md bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-slate-100">QuantRisk OS</div>
            <div className="text-xs text-slate-600">v1.0.0</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative',
                isActive
                  ? 'text-emerald-400 bg-emerald-500/10 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-emerald-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#161b27]'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-4 border-t border-[#1e2635] text-slate-600 hover:text-slate-400 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
