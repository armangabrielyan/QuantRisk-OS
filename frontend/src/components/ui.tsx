import { cn } from '@/lib/utils'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import React from 'react'

// ── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number
  subValue?: string
  status?: 'pass' | 'fail' | 'warn' | 'neutral'
  className?: string
}

const statusColors: Record<string, string> = {
  pass: 'text-emerald-400',
  fail: 'text-red-400',
  warn: 'text-amber-400',
  neutral: 'text-slate-300',
}

export function MetricCard({ label, value, subValue, status = 'neutral', className }: MetricCardProps) {
  return (
    <div className={cn(
      'bg-[#161b27] border border-[#1e2635] rounded-xl p-3 sm:p-4 min-w-0',
      className,
    )}>
      <div className="text-xs text-slate-500 truncate mb-1">{label}</div>
      <div className={cn(
        'text-lg sm:text-xl font-bold font-mono truncate',
        statusColors[status] ?? statusColors.neutral,
      )}>
        {value}
      </div>
      {subValue && <div className="text-xs text-slate-600 truncate mt-0.5">{subValue}</div>}
    </div>
  )
}

// ── SectionHeader ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function SectionHeader({ title, subtitle, children }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-[#1e2635]">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-slate-100">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface PanelProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <div className={cn('bg-[#161b27] border border-[#1e2635] rounded-xl p-3 sm:p-4', className)}>
      {title && (
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-[#1e2635]">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: 'PASS' | 'FAIL' | 'WARN' | string
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    PASS: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    FAIL: 'bg-red-500/20 text-red-400 border-red-500/30',
    WARN: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border',
      colors[status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    )}>
      {label ?? status}
    </span>
  )
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      <span className="text-sm text-slate-400">{message}</span>
    </div>
  )
}

// ── ErrorMessage ──────────────────────────────────────────────────────────────

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 sm:mt-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-red-300 break-words">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  )
}

// ── FormField ─────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && <label className="text-xs text-slate-400 font-medium block">{label}</label>}
      {children}
      {hint && <div className="text-xs text-slate-600">{hint}</div>}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        'w-full bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200',
        'focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500',
        'placeholder:text-slate-600',
        'min-h-[40px]', // touch-friendly
        className,
      )}
    />
  )
}

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'w-full bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200',
        'focus:outline-none focus:ring-1 focus:ring-emerald-500',
        'min-h-[40px]', // touch-friendly
        className,
      )}
    >
      {children}
    </select>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const buttonVariants: Record<string, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700',
  secondary: 'bg-[#1e2635] hover:bg-[#252f40] text-slate-300 border-[#2a3548]',
  danger: 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border-red-900/50',
}

const buttonSizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[34px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-5 py-2.5 text-sm font-medium min-h-[44px]',
}

export function Button({ variant = 'primary', size = 'md', className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
        buttonVariants[variant],
        buttonSizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ── DataTable ─────────────────────────────────────────────────────────────────

interface DataTableProps {
  headers: string[]
  rows: (string | number | React.ReactNode)[][]
  className?: string
}

export function DataTable({ headers, rows, className }: DataTableProps) {
  return (
    <div className={cn('overflow-x-auto -mx-1', className)}>
      <table className="w-full text-sm min-w-[300px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left text-xs text-slate-500 uppercase tracking-wider pb-2 border-b border-[#1e2635] pr-4 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1e2635]/50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-slate-300 font-mono text-xs">
                  {cell as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-0.5 border-b border-[#1e2635] overflow-x-auto scrollbar-hide', className)}>
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
            active === key
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-300',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
