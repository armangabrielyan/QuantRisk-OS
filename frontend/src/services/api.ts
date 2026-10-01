import axios from 'axios'

const BASE_URL = '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = error.message || 'An error occurred'
    const detail = error.response?.data?.detail
    if (detail) {
      if (Array.isArray(detail)) {
        message = detail.map(d => `${d.loc?.join('.') || 'Error'}: ${d.msg}`).join(', ')
      } else {
        message = detail
      }
    }
    return Promise.reject(new Error(message))
  }
)

// ── Market Risk ──────────────────────────────────────────────────────────────

export const marketRiskApi = {
  parametricVaR: (data: object) => api.post('/market-risk/var/parametric', data),
  historicalVaR: (data: object) => api.post('/market-risk/var/historical', data),
  monteCarloVaR: (data: object) => api.post('/market-risk/var/monte-carlo', data),
  volatility: (data: object) => api.post('/market-risk/volatility', data),
  blackScholes: (data: object) => api.post('/market-risk/black-scholes', data),
  impliedVol: (data: object) => api.post('/market-risk/implied-volatility', data),
  volSurface: (data: object) => api.post('/market-risk/volatility-surface', data),
  varBacktest: (data: object) => api.post('/market-risk/var/backtest', data),
  lVar: (data: object) => api.post('/market-risk/var/liquidity-adjusted', data),
}

// ── Credit Risk ───────────────────────────────────────────────────────────────

export const creditRiskApi = {
  expectedLoss: (data: object) => api.post('/credit-risk/expected-loss', data),
  mertonModel: (data: object) => api.post('/credit-risk/merton-model', data),
  creditScoring: (data: object) => api.post('/credit-risk/credit-scoring', data),
  pfeCva: (data: object) => api.post('/credit-risk/pfe-cva', data),
  scoringAdvMetrics: (data: object) => api.post('/credit-risk/advanced-metrics', data),
  transitionMatrix: (data: object) => api.post('/credit-risk/transition-matrix', data),
  concentration: (data: object) => api.post('/credit-risk/concentration', data),
  hhi: (data: object) => api.post('/credit-risk/hhi', data),
}

// ── ALM ───────────────────────────────────────────────────────────────────────

export const almApi = {
  durationGap: (data: object) => api.post('/alm/duration-gap', data),
  lcr: (data: object) => api.post('/alm/lcr', data),
  nsfr: (data: object) => api.post('/alm/nsfr', data),
  nssYieldCurve: (data: object) => api.post('/alm/nelson-siegel', data),
  bondMetrics: (data: object) => api.post('/alm/bond-metrics', data),
  repricingGap: (data: object) => api.post('/alm/repricing-gap', data),
  cumulativeGap: (data: object) => api.post('/alm/cumulative-gap', data),
  interestRateGap: (data: object) => api.post('/alm/interest-rate-gap', data),
}

// ── Econometrics ──────────────────────────────────────────────────────────────

export const econometricsApi = {
  timeSeries: (data: object) => api.post('/econometrics/time-series-diagnostics', data),
  acfPacf: (data: object) => api.post('/econometrics/acf-pacf', data),
  descriptiveStats: (data: object) => api.post('/econometrics/descriptive-stats', data),
  ols: (data: object) => api.post('/econometrics/ols-regression', data),
  diagnostics: (data: object) => api.post('/econometrics/diagnostics', data),
  vif: (data: object) => api.post('/econometrics/vif', data),
}


// ── Operational Risk ──────────────────────────────────────────────────────────

export const opRiskApi = {
  sma: (data: object) => api.post('/op-risk/sma', data),
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export const portfolioApi = {
  analytics: (data: object) => api.post('/portfolio/analytics', data),
  efficientFrontier: (data: object) => api.post('/portfolio/efficient-frontier', data),
  drawdown: (data: object) => api.post('/portfolio/drawdown', data),
  blackLitterman: (data: object) => api.post('/portfolio/black-litterman', data),
  riskParity: (data: object) => api.post('/portfolio/risk-parity', data),
  concentration: (data: object) => api.post('/portfolio/concentration', data),
  incrementalVar: (data: object) => api.post('/portfolio/incremental-var', data),
  marginalVar: (data: object) => api.post('/portfolio/marginal-var', data),
  componentVar: (data: object) => api.post('/portfolio/component-var', data),
  correlationStress: (data: object) => api.post('/portfolio/correlation-stress', data),
  varAttribution: (data: object) => api.post('/portfolio/var-attribution', data),
  pnlAttribution: (data: object) => api.post('/portfolio/pnl-attribution', data),
}

// ── Stress Testing ────────────────────────────────────────────────────────────

export const stressApi = {
  scenarios: () => api.get('/stress-testing/scenarios'),
  apply: (data: object) => api.post('/stress-testing/apply', data),
  applyPreset: (data: object) => api.post('/stress-testing/apply-preset', data),
  scenarioComparison: (data: object) => api.post('/stress-testing/compare', data),
}

// ── FRM Trainer ───────────────────────────────────────────────────────────────

export const frmApi = {
  questions: (params?: Record<string, string>) =>
    api.get('/frm-trainer/questions', { params }),
  question: (id: number) => api.get(`/frm-trainer/questions/${id}`),
  answer: (id: number) => api.get(`/frm-trainer/questions/${id}/answer`),
  startQuiz: (data: object) => api.post('/frm-trainer/quiz/start', data),
  submitAnswer: (data: object) => api.post('/frm-trainer/quiz/answer', data),
  completeQuiz: (data: object) => api.post('/frm-trainer/quiz/complete', data),
  history: () => api.get('/frm-trainer/history'),
  categories: () => api.get('/frm-trainer/categories'),
}

// ── Market Data ───────────────────────────────────────────────────────────────

export const dataApi = {
  fetch: (ticker: string, start?: string, end?: string, interval?: string) =>
    api.get('/data/fetch', { params: { ticker, start, end, interval } }),
  sample: (ticker: string, n?: number) =>
    api.get(`/data/sample/${ticker}`, { params: { n } }),
  sampleTickers: () => api.get('/data/sample-tickers'),
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const reportsApi = {
  riskCommittee: (data: object) => api.post('/reports/risk-committee', data),
}

// ── Health ────────────────────────────────────────────────────────────────────

export const healthApi = {
  health: () => api.get('/health'),
  info: () => api.get('/info'),
}

// ── New Risk Domains ─────────────────────────────────────────────────────────

export const esgApi = {
  waci: (data: object) => api.post('/esg/waci', data),
  getMetrics: () => api.get('/esg/metrics'),
  createMetric: (data: object) => api.post('/esg/metrics', data),
}

export const opRiskExtendedApi = {
  getIncidents: () => api.get('/operational/incidents'),
  createIncident: (data: object) => api.post('/operational/incidents', data),
}

export const vendorApi = {
  getVendors: () => api.get('/vendor'),
  createVendor: (data: object) => api.post('/vendor', data),
}

export const mrmApi = {
  getModels: () => api.get('/mrm/registry'),
  createModel: (data: object) => api.post('/mrm/registry', data),
}
