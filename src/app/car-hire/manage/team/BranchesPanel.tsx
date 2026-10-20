'use client'

import { useEffect, useState } from 'react'
import type { Branch } from '@/lib/car-hire'
import {
  createBranch,
  getBranches,
  ProviderApiError,
  updateBranch,
  type BranchInput,
} from '@/lib/car-hire-owner-api'
import { ghostButton, inputStyle, labelStyle, primaryButton } from '../components/ProviderUI'

type Draft = { name: string; address: string; phone: string; openingHours: string }

const EMPTY: Draft = { name: '', address: '', phone: '', openingHours: '' }

function draftFrom(branch: Branch): Draft {
  return {
    name: branch.name,
    address: branch.address ?? '',
    phone: branch.phone ?? '',
    openingHours: branch.openingHours ?? '',
  }
}

function toInput(draft: Draft): BranchInput {
  return {
    name: draft.name.trim(),
    address: draft.address.trim() || null,
    phone: draft.phone.trim() || null,
    openingHours: draft.openingHours.trim() || null,
  }
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ProviderApiError && err.status === 403) {
    return 'Your membership does not include fleet management.'
  }
  return err instanceof Error ? err.message : fallback
}

/** Pickup branches for one company. Listings choose a branch in the fleet editor. */
export default function BranchesPanel({
  operatorId,
  canManage,
  onSaved,
}: {
  operatorId: string
  canManage: boolean
  onSaved: (message: string) => void
}) {
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getBranches(operatorId)
      .then(rows => {
        if (!cancelled) setBranches(rows)
      })
      .catch(err => {
        if (!cancelled) {
          setBranches([])
          setError(errorText(err, 'Could not load branches.'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [operatorId])

  async function save() {
    if (!draft.name.trim()) {
      setError('Branch name is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved =
        editingId === 'new'
          ? await createBranch(operatorId, toInput(draft))
          : await updateBranch(operatorId, editingId as string, toInput(draft))
      if (saved) {
        setBranches(current => {
          const rest = (current ?? []).filter(branch => branch.id !== saved.id)
          return [...rest, saved].sort((a, b) => a.name.localeCompare(b.name))
        })
      }
      onSaved(`Branch ${draft.name.trim()} saved.`)
      setEditingId(null)
    } catch (err) {
      setError(errorText(err, 'Could not save the branch.'))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(branch: Branch) {
    setBusy(true)
    setError('')
    try {
      const saved = await updateBranch(operatorId, branch.id, { isActive: !branch.isActive })
      if (saved) {
        setBranches(current =>
          (current ?? []).map(row => (row.id === saved.id ? saved : row)),
        )
      }
      onSaved(
        branch.isActive
          ? `${branch.name} closed. Its listings show no branch until you pick another.`
          : `${branch.name} reopened.`,
      )
    } catch (err) {
      setError(errorText(err, 'Could not update the branch.'))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof Draft, label: string, placeholder = '') => (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <input
        value={draft[key]}
        onChange={event => setDraft({ ...draft, [key]: event.target.value })}
        placeholder={placeholder}
        disabled={busy}
        style={inputStyle}
      />
    </label>
  )

  return (
    <div style={block}>
      <div>
        <h3 style={subTitle}>Branches</h3>
        <p style={meta}>
          Where renters pick up and return cars. Each listing can be assigned to a branch from the
          fleet editor; renters see the branch name and address.
        </p>
      </div>

      {branches === null ? (
        <p style={meta}>Loading branches…</p>
      ) : branches.length === 0 ? (
        <p style={meta}>No branches yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {branches.map(branch => (
            <div key={branch.id} style={{ ...row, opacity: branch.isActive ? 1 : 0.6 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>
                  {branch.name}
                  {branch.isActive ? '' : ' (closed)'}
                </p>
                <p style={meta}>
                  {[branch.address, branch.phone, branch.openingHours].filter(Boolean).join(' · ') ||
                    'No address yet'}
                </p>
              </div>
              {canManage ? (
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    type="button"
                    style={smallButton}
                    disabled={busy}
                    onClick={() => {
                      setEditingId(branch.id)
                      setDraft(draftFrom(branch))
                      setError('')
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    style={smallButton}
                    disabled={busy}
                    onClick={() => void toggle(branch)}
                  >
                    {branch.isActive ? 'Close' : 'Reopen'}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage && editingId ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={grid}>
            {field('name', 'Branch name', 'Lilongwe Airport')}
            {field('address', 'Address', 'Kamuzu International Airport, arrivals')}
            {field('phone', 'Branch phone')}
            {field('openingHours', 'Opening hours', 'Mon–Sat 07:00–19:00')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={primaryButton} disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save branch'}
            </button>
            <button
              type="button"
              style={ghostButton}
              disabled={busy}
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : canManage ? (
        <div>
          <button
            type="button"
            style={ghostButton}
            onClick={() => {
              setEditingId('new')
              setDraft(EMPTY)
              setError('')
            }}
          >
            Add branch
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ ...meta, color: '#B91C1C', fontWeight: 700 }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

const block = {
  display: 'grid',
  gap: 10,
  marginTop: 14,
  paddingTop: 14,
  borderTop: '1px solid var(--border)',
} as const

const subTitle = { margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: '-0.2px' } as const

const meta = { margin: '3px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' } as const

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
} as const

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 8,
} as const

const smallButton = { ...ghostButton, padding: '5px 9px', fontSize: 11 } as const
