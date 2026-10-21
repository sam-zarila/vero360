'use client'

import { useEffect, useState } from 'react'
import { carTitle, type OwnerVehicle } from '@/lib/car-hire'
import {
  getRateRules,
  previewPrice,
  ProviderApiError,
  saveRateRules,
  type PricePreview,
  type RateRule,
  type RateRuleKind,
} from '@/lib/car-hire-owner-api'
import { formatMwk } from '@/lib/vero-api'
import { ghostButton, inputStyle, labelStyle, primaryButton } from '../components/ProviderUI'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const KIND_COPY: Record<RateRuleKind, { title: string; hint: string }> = {
  DURATION: {
    title: 'Long-rental discount',
    hint: 'Take a percentage off rentals of at least this many days. The best tier applies.',
  },
  SEASONAL: {
    title: 'Seasonal rate',
    hint: 'A fixed daily rate or a percentage change between two dates (inclusive).',
  },
  WEEKEND: {
    title: 'Day-of-week rate',
    hint: 'A percentage change on chosen weekdays. Stacks on top of a seasonal rate.',
  },
}

function newRule(kind: RateRuleKind): RateRule {
  if (kind === 'DURATION') return { kind, minDays: 7, adjustPercent: 10, isActive: true }
  if (kind === 'WEEKEND') return { kind, daysOfWeek: [5, 6], adjustPercent: 15, isActive: true }
  const today = new Date().toISOString().slice(0, 10)
  return { kind, startDate: today, endDate: today, adjustPercent: 20, isActive: true }
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ProviderApiError && err.status === 403) {
    return 'Your membership does not include fleet management.'
  }
  return err instanceof Error ? err.message : fallback
}

function defaultPreviewRange() {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  return { start: local(start), end: local(end) }
}

/** Company-set pricing rules for one listing, with a live price preview. */
export default function FleetPricingPanel({
  car,
  unitCount,
  onSaved,
}: {
  car: OwnerVehicle
  unitCount: number
  onSaved: (message: string) => void
}) {
  const [rules, setRules] = useState<RateRule[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [range, setRange] = useState(defaultPreviewRange)
  const [preview, setPreview] = useState<PricePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRateRules(car.id)
      .then(result => {
        if (!cancelled) setRules(result.rules)
      })
      .catch(err => {
        if (!cancelled) setLoadError(errorText(err, 'Could not load pricing rules.'))
      })
    return () => {
      cancelled = true
    }
  }, [car.id])

  function update(index: number, patch: Partial<RateRule>) {
    setRules(current =>
      current ? current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) : current,
    )
    setPreview(null)
  }

  function remove(index: number) {
    setRules(current => (current ? current.filter((_, i) => i !== index) : current))
    setPreview(null)
  }

  async function runPreview() {
    if (!rules) return
    setPreviewing(true)
    setError('')
    try {
      setPreview(
        await previewPrice(car.id, {
          startAt: new Date(`${range.start}T09:00:00`).toISOString(),
          endAt: new Date(`${range.end}T09:00:00`).toISOString(),
          rules,
        }),
      )
    } catch (err) {
      setError(errorText(err, 'Could not preview the price.'))
    } finally {
      setPreviewing(false)
    }
  }

  async function save() {
    if (!rules) return
    setSaving(true)
    setError('')
    try {
      setRules(await saveRateRules(car.id, rules))
      onSaved(
        `Pricing saved for ${carTitle(car)}${unitCount > 1 ? ` (all ${unitCount} units)` : ''}. New quotes use it immediately.`,
      )
    } catch (err) {
      setError(errorText(err, 'Could not save the pricing rules.'))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return <p style={{ ...meta, color: '#B91C1C', marginTop: 12 }}>{loadError}</p>
  }
  if (!rules) {
    return <p style={{ ...meta, marginTop: 12 }}>Loading pricing…</p>
  }

  return (
    <div style={panel}>
      <p style={heading}>Pricing · base {formatMwk(car.dailyRate)} / day</p>
      <p style={{ ...meta, marginBottom: 10 }}>
        Seasonal and day-of-week changes multiply each day&apos;s rate; the best long-rental discount
        is then taken off the total. Edit the base rate with Edit.
      </p>

      <div style={{ display: 'grid', gap: 8 }}>
        {rules.length === 0 ? (
          <p style={meta}>No rules yet — every day is charged the base rate.</p>
        ) : null}
        {rules.map((rule, index) => (
          <div key={index} style={ruleBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 900 }}>{KIND_COPY[rule.kind].title}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ ...meta, display: 'flex', gap: 4, alignItems: 'center', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={rule.isActive !== false}
                    onChange={event => update(index, { isActive: event.target.checked })}
                  />
                  On
                </label>
                <button type="button" style={smallButton} onClick={() => remove(index)}>
                  Remove
                </button>
              </div>
            </div>
            <div style={grid}>
              <Field label="Label (shown on receipt)">
                <input
                  value={rule.label ?? ''}
                  onChange={event => update(index, { label: event.target.value })}
                  placeholder={rule.kind === 'SEASONAL' ? 'Festive season' : 'Optional'}
                  style={inputStyle}
                />
              </Field>
              {rule.kind === 'DURATION' ? (
                <>
                  <Field label="From (days)">
                    <input
                      type="number"
                      min={1}
                      value={rule.minDays ?? ''}
                      onChange={event => update(index, { minDays: numberOrNull(event.target.value) })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Discount %">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={rule.adjustPercent ?? ''}
                      onChange={event =>
                        update(index, { adjustPercent: numberOrNull(event.target.value) })
                      }
                      style={inputStyle}
                    />
                  </Field>
                </>
              ) : null}
              {rule.kind === 'SEASONAL' ? (
                <>
                  <Field label="From">
                    <input
                      type="date"
                      value={rule.startDate ?? ''}
                      onChange={event => update(index, { startDate: event.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="To">
                    <input
                      type="date"
                      value={rule.endDate ?? ''}
                      onChange={event => update(index, { endDate: event.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Fixed rate / day">
                    <input
                      type="number"
                      min={1}
                      value={rule.dailyRate ?? ''}
                      placeholder="or use %"
                      onChange={event => {
                        const dailyRate = numberOrNull(event.target.value)
                        update(index, dailyRate ? { dailyRate, adjustPercent: null } : { dailyRate: null })
                      }}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Change %">
                    <input
                      type="number"
                      min={-90}
                      max={300}
                      value={rule.dailyRate ? '' : (rule.adjustPercent ?? '')}
                      disabled={!!rule.dailyRate}
                      onChange={event =>
                        update(index, { adjustPercent: numberOrNull(event.target.value) })
                      }
                      style={inputStyle}
                    />
                  </Field>
                </>
              ) : null}
              {rule.kind === 'WEEKEND' ? (
                <>
                  <Field label="Change %">
                    <input
                      type="number"
                      min={-90}
                      max={300}
                      value={rule.adjustPercent ?? ''}
                      onChange={event =>
                        update(index, { adjustPercent: numberOrNull(event.target.value) })
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {WEEKDAYS.map((day, dayIndex) => {
                      const selected = rule.daysOfWeek?.includes(dayIndex) ?? false
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            const current = new Set(rule.daysOfWeek ?? [])
                            if (selected) current.delete(dayIndex)
                            else current.add(dayIndex)
                            update(index, { daysOfWeek: Array.from(current).sort() })
                          }}
                          style={{
                            ...smallButton,
                            background: selected ? '#111827' : undefined,
                            color: selected ? '#fff' : undefined,
                          }}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
            <p style={{ ...meta, marginTop: 6 }}>{KIND_COPY[rule.kind].hint}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {(Object.keys(KIND_COPY) as RateRuleKind[]).map(kind => (
          <button
            key={kind}
            type="button"
            style={smallButton}
            onClick={() => {
              setRules(current => [...(current ?? []), newRule(kind)])
              setPreview(null)
            }}
          >
            + {KIND_COPY[kind].title}
          </button>
        ))}
      </div>

      <div style={{ ...ruleBox, marginTop: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 900 }}>Preview a rental</p>
        <div style={{ ...grid, marginTop: 6 }}>
          <Field label="Pick-up">
            <input
              type="date"
              value={range.start}
              onChange={event => setRange({ ...range, start: event.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Return">
            <input
              type="date"
              value={range.end}
              onChange={event => setRange({ ...range, end: event.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={previewing}
          style={{ ...ghostButton, marginTop: 6 }}
        >
          {previewing ? 'Calculating…' : 'Preview price'}
        </button>
        {preview ? (
          <div style={{ marginTop: 8, display: 'grid', gap: 3 }}>
            {preview.lineItems.map((item, i) => (
              <div key={`${item.code}-${i}`} style={lineRow}>
                <span>{item.label}</span>
                <span>{item.amount < 0 ? `−${formatMwk(-item.amount)}` : formatMwk(item.amount)}</span>
              </div>
            ))}
            <div style={{ ...lineRow, fontWeight: 900, color: 'var(--text-1, #111)' }}>
              <span>Rental total</span>
              <span>{formatMwk(preview.rentalTotal)}</span>
            </div>
            <p style={meta}>
              Average {formatMwk(preview.effectiveDailyRate)} / day. Deposit is added separately.
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" style={{ ...meta, color: '#B91C1C', fontWeight: 700, marginTop: 8 }}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        style={{ ...primaryButton, marginTop: 10 }}
      >
        {saving ? 'Saving…' : 'Save pricing'}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

const panel = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const

const ruleBox = {
  padding: 10,
  borderRadius: 10,
  background: 'var(--bg, #fff)',
  border: '1px solid var(--border)',
} as const

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: 6,
  marginTop: 6,
} as const

const heading = {
  margin: '0 0 4px',
  fontSize: 12,
  fontWeight: 900,
  color: 'var(--text-2)',
} as const

const meta = {
  margin: 0,
  fontSize: 11,
  lineHeight: 1.5,
  color: 'var(--text-3)',
} as const

const lineRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 12,
  color: 'var(--text-2)',
} as const

const smallButton = {
  ...ghostButton,
  padding: '5px 9px',
  fontSize: 11,
} as const
