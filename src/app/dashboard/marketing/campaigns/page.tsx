'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  MARKETING_CAMPAIGN_CHANNELS,
  MARKETING_CAMPAIGN_STATUSES,
  buildTrackedLinks,
  normalizeMarketingCampaignStatus,
  slugifyCampaign,
  type MarketingCampaign,
  type MarketingCampaignStatus,
} from '@/lib/marketing-campaigns'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { MarketingSubNav } from '../MarketingSubNav'

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
}

type FormState = {
  name: string
  status: MarketingCampaignStatus
  objective: string
  channels: string[]
  startDate: string
  endDate: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  landingPath: string
  audience: string
  creativeNotes: string
  cta: string
  notes: string
  budgetMwk: string
  targetInstalls: string
  targetSignups: string
}

function emptyForm(): FormState {
  return {
    name: '',
    status: 'draft',
    objective: '',
    channels: ['Facebook'],
    startDate: '',
    endDate: '',
    utmSource: 'marketing',
    utmMedium: 'social',
    utmCampaign: '',
    landingPath: '/',
    audience: '',
    creativeNotes: '',
    cta: 'Get the app',
    notes: '',
    budgetMwk: '',
    targetInstalls: '',
    targetSignups: '',
  }
}

function statusTone(status: MarketingCampaignStatus) {
  if (status === 'active') return { bg: '#ECFDF5', color: '#047857' }
  if (status === 'paused') return { bg: '#FFFBEB', color: '#B45309' }
  if (status === 'ended') return { bg: '#F1F5F9', color: '#475569' }
  return { bg: '#EFF6FF', color: '#1D4ED8' }
}

export default function MarketingCampaignsPage() {
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()
  const [items, setItems] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketing-campaigns', { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load campaigns')
      setItems(Array.isArray(body.items) ? body.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const previewSlug = useMemo(
    () => form.utmCampaign.trim() || slugifyCampaign(form.name),
    [form.utmCampaign, form.name],
  )

  const previewLinks = useMemo(
    () =>
      buildTrackedLinks({
        utmSource: form.utmSource || 'marketing',
        utmMedium: form.utmMedium || 'social',
        utmCampaign: previewSlug,
        landingPath: form.landingPath || '/',
      }),
    [form.utmSource, form.utmMedium, form.landingPath, previewSlug],
  )

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Campaign name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketing-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          status: form.status,
          objective: form.objective,
          channels: form.channels,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          utmSource: form.utmSource,
          utmMedium: form.utmMedium,
          utmCampaign: previewSlug,
          landingPath: form.landingPath || '/',
          audience: form.audience,
          creativeNotes: form.creativeNotes,
          cta: form.cta,
          notes: form.notes,
          budgetMwk: form.budgetMwk ? Number(form.budgetMwk) : null,
          targetInstalls: form.targetInstalls ? Number(form.targetInstalls) : null,
          targetSignups: form.targetSignups ? Number(form.targetSignups) : null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not create campaign')
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create campaign')
    } finally {
      setSaving(false)
    }
  }

  if (!sessionLoading && !isFullAdmin && !isMarketer) {
    return (
      <div>
        <DashboardBackLink />
        <p style={{ color: 'var(--text-3)' }}>Only admins and marketers can manage campaigns.</p>
      </div>
    )
  }

  return (
    <div>
      {isMarketer ? null : <DashboardBackLink />}
      <DashboardPageHeader
        sectionId="marketing"
        title="Campaigns"
        description="Organize growth campaigns, tracked links, and outcomes."
      />
      <MarketingSubNav />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          style={{
            border: 'none',
            borderRadius: 10,
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 700,
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Close form' : 'New campaign'}
        </button>
        <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
      </div>

      {error ? <p style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</p> : null}

      {showForm ? (
        <form onSubmit={onCreate} style={{ ...card, marginBottom: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Name
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Status
              <select
                value={form.status}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    status: normalizeMarketingCampaignStatus(e.target.value),
                  }))
                }
                style={inputStyle}
              >
                {MARKETING_CAMPAIGN_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              UTM source
              <input
                value={form.utmSource}
                onChange={e => setForm(f => ({ ...f, utmSource: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              UTM medium
              <input
                value={form.utmMedium}
                onChange={e => setForm(f => ({ ...f, utmMedium: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              UTM campaign slug
              <input
                value={form.utmCampaign}
                placeholder={previewSlug}
                onChange={e => setForm(f => ({ ...f, utmCampaign: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Landing path
              <input
                value={form.landingPath}
                onChange={e => setForm(f => ({ ...f, landingPath: e.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Channels
            <select
              multiple
              value={form.channels}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  channels: Array.from(e.target.selectedOptions).map(o => o.value),
                }))
              }
              style={{ ...inputStyle, minHeight: 88 }}
            >
              {MARKETING_CAMPAIGN_CHANNELS.map(ch => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Start
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              End
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Target installs
              <input
                value={form.targetInstalls}
                onChange={e => setForm(f => ({ ...f, targetInstalls: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              Target signups
              <input
                value={form.targetSignups}
                onChange={e => setForm(f => ({ ...f, targetSignups: e.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Objective / brief
            <textarea
              value={form.objective}
              onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
              rows={2}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Audience
            <input
              value={form.audience}
              onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Creative notes
            <textarea
              value={form.creativeNotes}
              onChange={e => setForm(f => ({ ...f, creativeNotes: e.target.value }))}
              rows={2}
              style={inputStyle}
            />
          </label>

          <div style={{ ...card, background: '#F8FAFC' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#64748B' }}>
              TRACKED LINK PREVIEW
            </p>
            <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{previewLinks.website}</code>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              border: 'none',
              borderRadius: 10,
              background: '#0369A1',
              color: '#fff',
              fontWeight: 700,
              padding: '10px 14px',
              cursor: saving ? 'wait' : 'pointer',
              width: 'fit-content',
            }}
          >
            {saving ? 'Saving…' : 'Create campaign'}
          </button>
        </form>
      ) : null}

      {loading && items.length === 0 ? (
        <p style={{ color: 'var(--text-3)' }}>Loading campaigns…</p>
      ) : items.length === 0 ? (
        <DashboardEmptyState
          icon="megaphone"
          color="#C2410C"
          title="No campaigns yet"
          hint="Create a campaign to generate tracked links and measure installs and signups."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(item => {
            const tone = statusTone(item.status)
            return (
              <Link
                key={item.id}
                href={`/dashboard/marketing/campaigns/${item.id}`}
                style={{ ...card, textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{item.name}</h2>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
                      {item.objective || 'No objective yet'} · utm_campaign={item.utmCampaign}
                    </p>
                  </div>
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: tone.bg,
                      color: tone.color,
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: 'capitalize',
                    }}
                  >
                    {item.status}
                  </span>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
                  {(item.channels || []).join(', ') || 'No channels'} · Open detail for links & performance →
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '9px 11px',
  font: 'inherit',
  background: '#fff',
}
