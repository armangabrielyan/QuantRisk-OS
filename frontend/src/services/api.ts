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
    const message = error.response?.data?.detail || error.message || 'An error occurred'
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
}

// ── Credit Risk ───────────────────────────────────────────────────────────────

export const creditRiskApi = {
  expectedLoss: (data: object) => api.post('/credit-risk/expected-loss', data),
  mertonModel: (data: object) => api.post('/credit-risk/merton-model', data),
  creditScoring: (data: object) => api.post('/credit-risk/credit-scoring', data),
}

// ── ALM ───────────────────────────────────────────────────────────────────────

export const almApi = {
  durationGap: (data: object) => api.post('/alm/duration-gap', data),
  lcr: (data: object) => api.post('/alm/lcr', data),
  nsfr: (data: object) => api.post('/alm/nsfr', data),
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

// ── Portfolio ─────────────────────────────────────────────────────────────────

export const portfolioApi = {
  analytics: (data: object) => api.post('/portfolio/analytics', data),
  efficientFrontier: (data: object) => api.post('/portfolio/efficient-frontier', data),
  drawdown: (data: object) => api.post('/portfolio/drawdown', data),
}

// ── Stress Testing ────────────────────────────────────────────────────────────

export const stressApi = {
  scenarios: () => api.get('/stress-testing/scenarios'),
  apply: (data: object) => api.post('/stress-testing/apply', data),
  applyPreset: (data: object) => api.post('/stress-testing/apply-preset', data),
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
