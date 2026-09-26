import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function fmt(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

export function fmtCurrency(value: number, decimals = 0): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(decimals)}`
}

export function fmtPct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function fmtBps(value: number): string {
  return `${(value * 10000).toFixed(1)} bps`
}

export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'PASS': return 'text-emerald-400'
    case 'FAIL': return 'text-red-400'
    case 'WARN': return 'text-amber-400'
    default: return 'text-slate-400'
  }
}

export function getRiskColor(value: number, good: 'high' | 'low' = 'low'): string {
  if (good === 'low') {
    if (value < 0.5) return 'text-emerald-400'
    if (value < 0.8) return 'text-amber-400'
    return 'text-red-400'
  } else {
    if (value > 1.5) return 'text-emerald-400'
    if (value > 1.0) return 'text-amber-400'
    return 'text-red-400'
  }
}
