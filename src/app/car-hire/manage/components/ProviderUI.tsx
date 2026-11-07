'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import type { StatusTone } from '@/lib/car-hire'

const CARD =
  'rounded-2xl bg-surface-container-lowest shadow-[0_2px_12px_rgba(0,31,63,0.06)]'

export function ProviderPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-center">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-[26px] font-extrabold leading-none tracking-tight text-primary">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-snug"
      style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
    >
      {label}
    </span>
  )
}

export function ProviderCard({
  children,
  style,
  padding = 18,
}: {
  children: ReactNode
  style?: CSSProperties
  padding?: number
}) {
  return (
    <div className={CARD} style={{ padding, ...style }}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string
  value: number | string
  hint?: string
  href?: string
  tone?: 'default' | 'warn' | 'good' | 'muted'
}) {
  const accent =
    tone === 'warn'
      ? '#964900'
      : tone === 'good'
        ? '#047857'
        : tone === 'muted'
          ? '#43474e'
          : '#000613'
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-2 font-heading text-[30px] font-extrabold leading-none tracking-tight" style={{ color: accent }}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] leading-snug text-on-surface-variant">{hint}</p> : null}
    </>
  )
  const className = `${CARD} block min-h-[112px] p-5 text-inherit no-underline`
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}

export function ProviderLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[120px] animate-pulse rounded-xl bg-surface-container-lowest shadow-[0_2px_10px_rgba(0,31,63,0.06)]"
          />
        ))}
      </div>
      <p className="text-[12px] font-semibold text-on-surface-variant">{label}</p>
    </div>
  )
}

export function ProviderError({
  message,
  onRetry,
  retryLabel = 'Try again',
  action,
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-error-container bg-error-container/30 p-6">
      <p className="text-[14px] font-bold leading-relaxed text-error">{message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry ? (
          <button type="button" onClick={onRetry} style={primaryButton}>
            {retryLabel}
          </button>
        ) : null}
        {action}
      </div>
    </div>
  )
}

export function ProviderEmpty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant/70 bg-surface-container-low px-6 py-10 text-center">
      <h2 className="font-heading text-[18px] font-bold text-primary">{title}</h2>
      <p className="mx-auto mt-2 max-w-[460px] text-[13px] leading-relaxed text-on-surface-variant">
        {body}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ProviderNotice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'success' | 'error'
  children: ReactNode
}) {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-secondary-fixed bg-secondary-fixed/40 text-on-secondary-fixed'
        : tone === 'error'
          ? 'border-error-container bg-error-container/40 text-error'
          : 'border-secondary-fixed bg-secondary-fixed/30 text-on-secondary-fixed'
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${className}`}>
      {children}
    </div>
  )
}

export const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: 'none',
  background: '#001f3f',
  color: '#fff',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  textAlign: 'center',
  boxShadow: '0 2px 8px rgba(0,31,63,0.18)',
}

export const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: 'none',
  background: '#fff',
  color: '#1c1b1b',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  textAlign: 'center',
  boxShadow: '0 1px 4px rgba(0,31,63,0.06)',
}

export const dangerButton: CSSProperties = {
  ...primaryButton,
  background: '#ba1a1a',
  boxShadow: 'none',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #c4c6cf',
  background: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#1c1b1b',
  outline: 'none',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#43474e',
  marginBottom: 5,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
}

export const mutedText: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: '#43474e',
}

export const filterBarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: '#f6f3f2',
}

export function filterChipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 8,
    border: 'none',
    background: active ? '#fff' : 'transparent',
    color: active ? '#000613' : '#43474e',
    fontSize: 12,
    fontWeight: active ? 700 : 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: active ? '0 1px 3px rgba(0,31,63,0.08)' : 'none',
  }
}

export const countPillStyle = (active: boolean): CSSProperties => ({
  minWidth: 18,
  padding: '0 6px',
  borderRadius: 999,
  background: active ? '#f0eded' : 'transparent',
  color: active ? '#000613' : '#43474e',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '17px',
  textAlign: 'center',
})
