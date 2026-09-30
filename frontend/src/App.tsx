import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { LoadingSpinner } from '@/components/ui'
import { useI18n } from '@/i18n'

// Lazy-load pages for fast initial load
const Overview = lazy(() => import('@/pages/Overview'))
const MarketRisk = lazy(() => import('@/pages/MarketRisk'))
const CreditRisk = lazy(() => import('@/pages/CreditRisk'))
const ALMLiquidity = lazy(() => import('@/pages/ALMLiquidity'))
const Econometrics = lazy(() => import('@/pages/Econometrics'))
const Portfolio = lazy(() => import('@/pages/Portfolio'))
const FRMTrainer = lazy(() => import('@/pages/FRMTrainer'))
const CrisisSandbox = lazy(() => import('@/pages/CrisisSandbox'))
const OperationalRisk = lazy(() => import('@/pages/OperationalRisk'))
const RiskIntelligence = lazy(() => import('@/pages/RiskIntelligence'))
const Reports = lazy(() => import('@/pages/Reports'))

function PageWrapper({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message={t.frm.loadingModule} />
      </div>
    }>
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#0f1117]">
        <Sidebar />
        {/* Desktop: offset for sidebar; Mobile: top padding for fixed header */}
        <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-w-0 overflow-x-hidden">
          <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto">
            <Routes>
              <Route path="/" element={<PageWrapper><Overview /></PageWrapper>} />
              <Route path="/market-risk" element={<PageWrapper><MarketRisk /></PageWrapper>} />
              <Route path="/credit-risk" element={<PageWrapper><CreditRisk /></PageWrapper>} />
              <Route path="/alm-liquidity" element={<PageWrapper><ALMLiquidity /></PageWrapper>} />
              <Route path="/econometrics" element={<PageWrapper><Econometrics /></PageWrapper>} />
              <Route path="/portfolio" element={<PageWrapper><Portfolio /></PageWrapper>} />
              <Route path="/cfa-prep" element={<PageWrapper><FRMTrainer mode="cfa" /></PageWrapper>} />
              <Route path="/frm-trainer" element={<PageWrapper><FRMTrainer mode="frm" /></PageWrapper>} />
              <Route path="/stress-testing" element={<PageWrapper><CrisisSandbox /></PageWrapper>} />
              <Route path="/op-risk" element={<PageWrapper><OperationalRisk /></PageWrapper>} />
              <Route path="/risk-intelligence" element={<PageWrapper><RiskIntelligence /></PageWrapper>} />
              <Route path="/reports" element={<PageWrapper><Reports /></PageWrapper>} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
