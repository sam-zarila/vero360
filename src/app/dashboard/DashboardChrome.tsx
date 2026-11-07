'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { VeroIcon, type VeroIconName } from '@/app/components/landing/icons'
import {
  getDashboardSection,
  type DashboardSectionId,
} from '@/lib/dashboard-sections'

export function DashboardBackLink({ label = 'Dashboard' }: { label?: string }) {
  return (
    <Link
      href="/dashboard"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-3)',
        marginBottom: 14,
        letterSpacing: '0.02em',
      }}
    >
      ← {label}
    </Link>
  )
}

type HeaderProps = {
  sectionId: DashboardSectionId | 'settings'
  title?: string
  description?: string
  actions?: ReactNode
  style?: CSSProperties
}

export function DashboardPageHeader({
  sectionId,
  title,
  description,
  actions,
  style,
}: HeaderProps) {
  const section = getDashboardSection(sectionId)
  if (!section) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 18,
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--primary)',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0, 31, 63, 0.18)',
          }}
        >
          <VeroIcon name={section.icon} size={22} color="currentColor" strokeWidth={2.35} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            {section.title}
          </p>
          <h1
            style={{
              margin: '4px 0 0',
              fontSize: 26,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.4px',
              color: 'var(--primary-dark)',
              lineHeight: 1.1,
            }}
          >
            {title ?? section.title}
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--text-3)',
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            {description ?? section.desc}
          </p>
        </div>
      </div>
      {actions ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function DashboardRefreshButton({
  onClick,
  disabled,
  label = 'Refresh',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: '#fff',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text-2)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <VeroIcon name="refresh" size={16} strokeWidth={2.35} />
      {label}
    </button>
  )
}

export function DashboardSearchField({
  value,
  onChange,
  placeholder,
  label = 'Search',
  onClear,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
  onClear?: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <label style={{ position: 'relative', flex: '1 1 260px' }}>
        <span className="sr-only">{label}</span>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '11px 14px 11px 42px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: '#fff',
            fontSize: 14,
            color: 'var(--text)',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-4)',
            pointerEvents: 'none',
            display: 'flex',
          }}
        >
          <VeroIcon name="search" size={18} strokeWidth={2.35} color="currentColor" />
        </span>
      </label>
      {value.trim() && onClear ? (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: '#fff',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-2)',
          }}
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}

export function DashboardThumbFallback({
  icon,
  color,
  bg,
  size = 28,
}: {
  icon: VeroIconName
  color: string
  bg: string
  size?: number
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        color,
        background: bg,
      }}
    >
      <VeroIcon name={icon} size={size} strokeWidth={2.35} color="currentColor" />
    </div>
  )
}

export function DashboardEmptyState({
  icon,
  color,
  title,
  hint,
}: {
  icon: VeroIconName
  color: string
  title: string
  hint?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 280,
        color: 'var(--text-3)',
        textAlign: 'center',
        padding: 24,
        borderRadius: 16,
        background: '#fff',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'var(--primary)',
          color: 'var(--accent)',
          display: 'grid',
          placeItems: 'center',
          marginBottom: 4,
        }}
      >
        <VeroIcon name={icon} size={26} strokeWidth={2.35} color={color || 'currentColor'} />
      </span>
      <p style={{ margin: 0, fontWeight: 800, color: 'var(--primary-dark)', fontSize: 15 }}>
        {title}
      </p>
      {hint ? (
        <p style={{ margin: 0, fontSize: 13, maxWidth: 360, lineHeight: 1.5 }}>{hint}</p>
      ) : null}
    </div>
  )
}
