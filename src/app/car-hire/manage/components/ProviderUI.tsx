'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import type { StatusTone } from '@/lib/car-hire'

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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 20,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow ? (
          <p
            style={{
              margin: '0 0 5px',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              color: '#C2410C',
            }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(25px, 3.4vw, 34px)',
            fontWeight: 900,
            letterSpacing: '-0.5px',
            fontFamily: 'var(--font-display)',
          }}
        >
          {title}
        </h1>
        {description ? (
          <p style={{ margin: '7px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-3)', maxWidth: 720 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 9px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
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
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-sm)',
        padding,
        ...style,
      }}
    >
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
    tone === 'warn' ? '#B45309' : tone === 'good' ? '#047857' : tone === 'muted' ? 'var(--text-3)' : 'var(--text)'
  const body = (
    <>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-4)' }}>
        {label}
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 900, letterSpacing: '-0.7px', color: accent }}>
        {value}
      </p>
      {hint ? <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>{hint}</p> : null}
    </>
  )
  if (href) {
    return (
      <Link href={href} style={{ ...statCardStyle, textDecoration: 'none', color: 'inherit' }}>
        {body}
      </Link>
    )
  }
  return <div style={statCardStyle}>{body}</div>
}

export function ProviderLoading({ label = 'Loading provider data…' }: { label?: string }) {
  return (
    <ProviderCard>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ height: 14, width: '38%', borderRadius: 6, background: 'var(--surface-2)' }} />
        <div style={{ height: 12, width: '72%', borderRadius: 6, background: 'var(--surface-2)' }} />
        <div style={{ height: 12, width: '56%', borderRadius: 6, background: 'var(--surface-2)' }} />
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{label}</p>
    </ProviderCard>
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
    <ProviderCard style={{ borderColor: '#FECACA', background: '#FFF7F7' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#991B1B', lineHeight: 1.55 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {onRetry ? (
          <button type="button" onClick={onRetry} style={primaryButton}>
            {retryLabel}
          </button>
        ) : null}
        {action}
      </div>
    </ProviderCard>
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
    <ProviderCard style={{ textAlign: 'center', padding: '38px 22px', borderStyle: 'dashed' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{title}</h2>
      <p style={{ margin: '8px auto 0', maxWidth: 460, fontSize: 14, lineHeight: 1.6, color: 'var(--text-3)' }}>
        {body}
      </p>
      {action ? <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>{action}</div> : null}
    </ProviderCard>
  )
}

export function ProviderNotice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'success' | 'error'
  children: ReactNode
}) {
  const palette =
    tone === 'success'
      ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
      : tone === 'warn'
        ? { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
        : tone === 'error'
          ? { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
          : { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' }
  return (
    <div
      style={{
        padding: '11px 13px',
        borderRadius: 12,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  )
}

export const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 11,
  padding: '11px 15px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  textAlign: 'center',
}

export const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  borderRadius: 11,
  padding: '11px 14px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  textAlign: 'center',
}

export const dangerButton: CSSProperties = {
  ...primaryButton,
  background: '#DC2626',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--text)',
  outline: 'none',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 900,
  color: 'var(--text-3)',
  marginBottom: 5,
  letterSpacing: 0.25,
}

export const mutedText: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--text-3)',
}

const statCardStyle: CSSProperties = {
  display: 'block',
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
  minHeight: 112,
}
