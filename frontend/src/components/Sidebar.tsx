import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingDown, CreditCard, BarChart2,
  PieChart, BookOpen, Zap, FileText, X, Menu, Globe,
  ChevronRight, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'overview' as const },
  { to: '/limits', icon: AlertTriangle, labelKey: 'limits' as const },
  { to: '/market-risk', icon: TrendingDown, labelKey: 'marketRisk' as const },
  { to: '/credit-risk', icon: CreditCard, labelKey: 'creditRisk' as const },
  { to: '/alm-liquidity', icon: Zap, labelKey: 'almLiquidity' as const },
  { to: '/portfolio', icon: PieChart, labelKey: 'portfolio' as const },
  { to: '/stress-testing', icon: Zap, labelKey: 'crisisSandbox' as const },
  { to: '/op-risk', icon: AlertTriangle, labelKey: 'opRisk' as const },
  { to: '/econometrics', icon: BarChart2, labelKey: 'econometrics' as const },
  { to: '/risk-intelligence', icon: Globe, labelKey: 'riskIntel' as const },
  { to: '/reports', icon: FileText, labelKey: 'reports' as const },
  { to: '/cfa-prep', icon: BookOpen, labelKey: 'cfaTrainer' as const },
  { to: '/frm-trainer', icon: BookOpen, labelKey: 'frmTrainer' as const },
]

function NavItem({ to, icon: Icon, label, onClick }: { to: string; icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          'hover:bg-emerald-500/10 hover:text-emerald-400',
          isActive
            ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500'
            : 'text-slate-400 border-l-2 border-transparent',
        )
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label || 'Limits & Alerts'}</span>
    </NavLink>
  )
}

function LangToggle({ mobile = false }: { mobile?: boolean }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={cn('flex items-center gap-1 rounded-lg p-1 bg-[#0f1117] border border-[#1e2635]', mobile && 'w-full justify-center')}>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'px-3 py-1.5 rounded text-xs font-semibold transition-all',
          lang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200',
        )}
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        onClick={() => setLang('ru')}
        className={cn(
          'px-3 py-1.5 rounded text-xs font-semibold transition-all',
          lang === 'ru' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200',
        )}
        aria-label="Switch to Russian"
      >
        RU
      </button>
    </div>
  )
}

export function Sidebar() {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  // Close drawer on navigation
  useEffect(() => { setIsOpen(false) }, [location.pathname])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const navLabels = t.nav

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[#161b27] border-b border-[#1e2635]">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-base tracking-wide">QuantRisk OS</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            aria-label={t.common.menu}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 h-full w-72 z-50 bg-[#161b27] border-r border-[#1e2635] transition-transform duration-300 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#1e2635]">
          <div>
            <div className="text-emerald-400 font-bold text-sm tracking-widest uppercase">QuantRisk OS</div>
            <div className="text-slate-600 text-xs mt-0.5">{t.nav.version}</div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1e2635] transition-colors"
            aria-label={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ to, icon, labelKey }) => (
            <NavItem
              key={to}
              to={to}
              icon={icon}
              label={navLabels[labelKey]}
              onClick={() => setIsOpen(false)}
            />
          ))}
        </nav>

        {/* Language switcher footer */}
        <div className="p-4 border-t border-[#1e2635] space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Globe className="w-3.5 h-3.5" />
            <span>{t.common.language}</span>
          </div>
          <LangToggle mobile />
        </div>
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-56 flex-col bg-[#161b27] border-r border-[#1e2635] z-30">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[#1e2635]">
          <div className="text-emerald-400 font-bold text-sm tracking-widest uppercase">QuantRisk OS</div>
          <div className="text-slate-600 text-xs mt-1">{t.nav.version}</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ to, icon, labelKey }) => (
            <NavItem key={to} to={to} icon={icon} label={navLabels[labelKey]} />
          ))}
        </nav>

        {/* Language + footer */}
        <div className="p-3 border-t border-[#1e2635] space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Globe className="w-3 h-3" />
            <span>{t.common.language}</span>
          </div>
          <LangToggle />
          <div className="text-xs text-slate-700 text-center pt-1">
            Quantitative Finance Workbench
          </div>
        </div>
      </aside>
    </>
  )
}
