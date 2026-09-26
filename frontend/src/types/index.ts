// Shared TypeScript types for QuantRisk OS frontend

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error'
  data?: T
  detail?: string
}

// ── Market Risk ─────────────────────────────────────────────────────────────

export interface VaRResult {
  var: number
  var_pct: number
  es: number
  es_pct: number
  mu_daily?: number
  sigma_daily?: number
  confidence: number
  holding_period: number
  distribution?: string
  n_observations?: number
  simulated_pnl?: number[]
  mean_pnl?: number
  std_pnl?: number
}

export interface VolatilityResult {
  volatility_daily: number
  volatility_annual: number
  lambda?: number
  omega?: number
  alpha?: number
  beta?: number
  persistence?: number
  log_likelihood?: number
  method: string
}

export interface BSMResult {
  price: number
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
  d1: number
  d2: number
  intrinsic_value: number
  time_value: number
  moneyness: number
}

export interface ImpliedVolResult {
  implied_vol: number | null
  implied_vol_pct?: number
  converged: boolean
  error?: string
}

// ── Credit Risk ──────────────────────────────────────────────────────────────

export interface ExposureItem {
  name: string
  pd: number
  lgd: number
  ead: number
  el?: number
  el_pct?: number
}

export interface ELResult {
  total_el: number
  total_ead: number
  total_el_pct: number
  weighted_avg_pd: number
  weighted_avg_lgd: number
  n_exposures: number
  exposures: ExposureItem[]
}

export interface MertonResult {
  distance_to_default: number
  pd: number
  pd_pct: number
  equity_value: number
  asset_value: number
  debt_pv: number
  leverage_ratio: number
  d1: number
  d2: number
  implied_credit_spread_bps?: number
}

// ── ALM ──────────────────────────────────────────────────────────────────────

export interface DurationGapResult {
  duration_gap: number
  equity_sensitivity: number
  equity_sensitivity_pct: number
  asset_duration: number
  liability_duration: number
  asset_value: number
  liability_value: number
  equity_value: number
  leverage_ratio: number
  rate_shock: number
  rate_shock_bps: number
  delta_assets: number
  delta_liabilities: number
  delta_equity: number
  interpretation: string
}

export interface LCRResult {
  lcr: number
  lcr_pct: number
  hqla: number
  gross_outflows: number
  gross_inflows: number
  capped_inflows: number
  net_cash_outflows: number
  status: 'PASS' | 'FAIL'
  interpretation: string
  surplus_deficit: number
}

export interface NSFRResult {
  nsfr: number
  nsfr_pct: number
  asf: number
  rsf: number
  surplus_deficit: number
  status: 'PASS' | 'FAIL'
  interpretation: string
  components_asf: Array<{ name: string; amount: number; factor: number; weighted_amount: number }>
  components_rsf: Array<{ name: string; amount: number; factor: number; weighted_amount: number }>
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface PortfolioResult {
  portfolio_return: number
  portfolio_volatility: number
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: number
  covariance_matrix: number[][]
  correlation_matrix: number[][]
  asset_names: string[]
  asset_returns: number[]
  asset_volatilities: number[]
  weights: number[]
  drawdown_series: number[]
}

export interface EfficientFrontierResult {
  frontier_returns: number[]
  frontier_vols: number[]
  frontier_sharpes: number[]
  min_vol_portfolio: { return: number; volatility: number; sharpe: number; weights: Record<string, number> }
  max_sharpe_portfolio: { return: number; volatility: number; sharpe: number; weights: Record<string, number> }
  asset_returns: number[]
  asset_vols: number[]
  asset_names: string[]
}

// ── Stress Test ───────────────────────────────────────────────────────────────

export interface StressResult {
  scenario_name: string
  base: { portfolio_value: number; var: number; es: number; volatility: number; lcr: number }
  stress: { portfolio_value: number; var: number; es: number; volatility: number; lcr: number }
  impact: {
    equity_pnl: number
    total_pnl: number
    total_loss: number
    pct_loss: number
    var_change: number
    var_change_pct: number
    vol_change: number
    lcr_change: number
  }
  shocks_applied: Record<string, number>
}

// ── FRM ───────────────────────────────────────────────────────────────────────

export interface FRMQuestion {
  id: number
  category: string
  subcategory?: string
  difficulty: 'easy' | 'medium' | 'hard'
  prompt: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  formula?: string
  is_calculation: boolean
  tags?: string[]
}

export interface FRMAnswer {
  is_correct: boolean
  selected_answer: string
  correct_answer: string
  explanation: string
  formula?: string
  derivation?: string
  common_mistake?: string
}

export interface QuizSession {
  session_id: number
  questions: FRMQuestion[]
  n_questions: number
  session_name: string
}
