'use client'

import { inputStyle, labelStyle } from './ProviderUI'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function defaultBlockRange(): { startAt: string; endAt: string } {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { startAt: isoToLocalInput(start.toISOString()), endAt: isoToLocalInput(end.toISOString()) }
}

export function DateRangeFields({
  idPrefix,
  startAt,
  endAt,
  onStartChange,
  onEndChange,
  disabled,
}: {
  idPrefix: string
  startAt: string
  endAt: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
      <div>
        <label htmlFor={`${idPrefix}-start`} style={labelStyle}>
          Start
        </label>
        <input
          id={`${idPrefix}-start`}
          type="datetime-local"
          value={startAt}
          onChange={event => onStartChange(event.target.value)}
          disabled={disabled}
          required
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-end`} style={labelStyle}>
          End
        </label>
        <input
          id={`${idPrefix}-end`}
          type="datetime-local"
          value={endAt}
          onChange={event => onEndChange(event.target.value)}
          disabled={disabled}
          required
          style={inputStyle}
        />
      </div>
    </div>
  )
}
