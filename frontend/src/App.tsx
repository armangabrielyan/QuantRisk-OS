import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { LoadingSpinner } from '@/components/ui'

// Lazy-load pages for fast initial load
const Overview = lazy(() => import('@/pages/Overview'))
const MarketRisk = lazy(() => import('@/pages/MarketRisk'))
const CreditALM = lazy(() => import('@/pages/CreditALM'))
const Econometrics = lazy(() => import('@/pages/Econometrics'))
const Portfolio = lazy(() => import('@/pages/Portfolio'))
const FRMTrainer = lazy(() => import('@/pages/FRMTrainer'))
const CrisisSandbox = lazy(() => import('@/pages/CrisisSandbox'))
const Reports = lazy(() => import('@/pages/Reports'))

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Loading module..." />
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
        {/* Main content — offset for sidebar */}
        <main className="flex-1 ml-56 p-6 max-w-[1600px]">
          <Routes>
            <Route path="/" element={<PageWrapper><Overview /></PageWrapper>} />
            <Route path="/market-risk" element={<PageWrapper><MarketRisk /></PageWrapper>} />
            <Route path="/credit-alm" element={<PageWrapper><CreditALM /></PageWrapper>} />
            <Route path="/econometrics" element={<PageWrapper><Econometrics /></PageWrapper>} />
            <Route path="/portfolio" element={<PageWrapper><Portfolio /></PageWrapper>} />
            <Route path="/frm-trainer" element={<PageWrapper><FRMTrainer /></PageWrapper>} />
            <Route path="/stress" element={<PageWrapper><CrisisSandbox /></PageWrapper>} />
            <Route path="/reports" element={<PageWrapper><Reports /></PageWrapper>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
