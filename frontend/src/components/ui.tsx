import React from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  subValue?: string
  status?: 'pass' | 'fail' | 'warn' | 'neutral'
  icon?: React.ReactNode
  mono?: boolean
  className?: string
}

export function MetricCard({ label, value, subValue, status, icon, mono = true, className }: MetricCardProps) {
  const statusColors = {
    pass: 'border-emerald-500/30 bg-emerald-500/5',
    fail: 'border-red-500/30 bg-red-500/5',
    warn: 'border-amber-500/30 bg-amber-500/5',
    neutral: 'border-[#1e2635]',
  }

  return (
    <div className={cn(
      'bg-[#161b27] border rounded-lg p-4 flex flex-col gap-1',
      status ? statusColors[status] : 'border-[#1e2635]',
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-slate-600">{icon}</span>}
      </div>
      <div className={cn('text-2xl font-semibold text-slate-100', mono && 'font-mono')}>{value}</div>
      {subValue && <div className="text-xs text-slate-500">{subValue}</div>}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function SectionHeader({ title, subtitle, children }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

interface PanelProps {
  title?: string
  children: React.ReactNode
  className?: string
  collapsible?: boolean
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <div className={cn('bg-[#161b27] border border-[#1e2635] rounded-lg p-4', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-300 mb-4 pb-2 border-b border-[#1e2635]">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

interface BadgeProps {
  status: 'pass' | 'fail' | 'warn' | string
  label?: string
}

export function StatusBadge({ status, label }: BadgeProps) {
  const classes = {
    PASS: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    FAIL: 'bg-red-500/20 text-red-400 border-red-500/30',
    WARN: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }
  const key = status.toUpperCase()
  const cls = classes[key as keyof typeof classes] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', cls)}>
      {label || status}
    </span>
  )
}

interface LoadingProps {
  message?: string
}

export function LoadingSpinner({ message = 'Calculating...' }: LoadingProps) {
  return (
    <div className="flex items-center gap-3 text-slate-400 py-8 justify-center">
      <svg className="animate-spin h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm">{message}</span>
    </div>
  )
}

interface ErrorMsgProps {
  message: string
  onRetry?: () => void
}

export function ErrorMessage({ message, onRetry }: ErrorMsgProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
      <div className="font-medium mb-1">Error</div>
      <div>{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  )
}

interface FormFieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {children}
      {hint && <span className="text-xs text-slate-600">{hint}</span>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        'bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200',
        'focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500',
        'placeholder:text-slate-600 w-full font-mono',
        className
      )}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'bg-[#0f1117] border border-[#1e2635] rounded-md px-3 py-2 text-sm text-slate-200',
        'focus:outline-none focus:ring-1 focus:ring-emerald-500',
        'w-full',
        className
      )}
    >
      {children}
    </select>
  )
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    secondary: 'bg-[#1e2635] hover:bg-[#2d3a4f] text-slate-300 border border-[#2d3a4f]',
    danger: 'bg-red-600/80 hover:bg-red-600 text-white',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  return (
    <button
      {...props}
      className={cn(
        'rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  )
}

interface DataTableProps {
  headers: string[]
  rows: (string | number | React.ReactNode)[][]
  className?: string
}

export function DataTable({ headers, rows, className }: DataTableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left text-xs text-slate-500 uppercase tracking-wider pb-2 border-b border-[#1e2635] pr-4">
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
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
