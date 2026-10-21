'use client'

import { useState, type CSSProperties } from 'react'
import {
  actionLabel,
  actionRequiresNote,
  opsListingActions,
  opsListingTitle,
  type CarHireModerationAction,
  type OpsListing,
} from '@/lib/car-hire-ops'
import { adminFetch } from '@/lib/panel-client-auth'
import { useConfirm } from '../ConfirmDialog'

/** Turns a proxy error body into a message, preferring the server's own text. */
export function opsApiError(data: unknown, status: number, fallback: string): string {
  const body =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const serverError =
    typeof body.error === 'string' && body.error.trim()
      ? body.error.trim()
      : typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : ''
  if (serverError) return serverError
  if (status === 503) {
    return 'Car hire operations are not configured on this server. Set CAR_HIRE_OPS_KEY and restart the panel.'
  }
  if (status === 401 || status === 403) {
    return 'Your panel session cannot perform this action. Sign in again and retry.'
  }
  return fallback
}

function busyLabel(action: CarHireModerationAction): string {
  switch (action) {
    case 'approve':
      return 'Approving…'
    case 'reject':
      return 'Sending…'
    case 'suspend':
      return 'Suspending…'
    case 'restore':
      return 'Restoring…'
  }
}

function doneMessage(action: CarHireModerationAction, title: string): string {
  switch (action) {
    case 'approve':
      return `${title} is published.`
    case 'reject':
      return `${title} was sent back to the company.`
    case 'suspend':
      return `${title} was suspended.`
    case 'restore':
      return `${title} was restored.`
  }
}

export default function ListingActions({
  listing,
  onDone,
  onError,
  groupPublish = false,
}: {
  listing: OpsListing
  onDone: (message: string) => void | Promise<void>
  onError: (message: string) => void
  /** Detail view: always spell out that the whole listing group changes. */
  groupPublish?: boolean
}) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState<CarHireModerationAction | null>(null)
  const [noteAction, setNoteAction] = useState<CarHireModerationAction | null>(null)
  const [note, setNote] = useState('')

  const actions = opsListingActions(listing.listingStatus)
  if (actions.length === 0) return null

  const title = opsListingTitle(listing)

  async function run(action: CarHireModerationAction, noteText?: string) {
    setBusy(action)
    try {
      const res = await adminFetch(
        `/api/admin/car-hire/listings/${listing.id}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify(noteText ? { note: noteText } : {}),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(opsApiError(data, res.status, `${actionLabel(action)} failed`))
      }
      setNoteAction(null)
      setNote('')
      await onDone(doneMessage(action, title))
    } catch (err) {
      onError(err instanceof Error ? err.message : `${actionLabel(action)} failed`)
    } finally {
      setBusy(null)
    }
  }

  async function start(action: CarHireModerationAction) {
    if (actionRequiresNote(action)) {
      setNote('')
      setNoteAction(action)
      return
    }

    const group =
      groupPublish || listing.listingGroupId
        ? '\n\nEvery unit in this listing group is published together.'
        : ''

    const ok =
      action === 'approve'
        ? await confirm({
            title: 'Approve & publish?',
            message: `Publish ${title} so renters can find and book it.${group}`,
            confirmLabel: 'Approve & publish',
            danger: false,
          })
        : await confirm({
            title: 'Restore listing?',
            message: `Restore ${title} to published so renters can book it again.`,
            confirmLabel: 'Restore',
            danger: false,
          })
    if (!ok) return
    void run(action)
  }

  function closeNote() {
    if (busy) return
    setNoteAction(null)
    setNote('')
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {actions.map(action => {
          const danger = action === 'reject' || action === 'suspend'
          const isBusy = busy === action
          return (
            <button
              key={action}
              type="button"
              disabled={busy !== null}
              aria-busy={isBusy}
              onClick={() => void start(action)}
              style={buttonStyle(danger, action === 'approve')}
            >
              {isBusy ? busyLabel(action) : actionLabel(action)}
            </button>
          )
        })}
      </div>

      {noteAction ? (
        <div
          style={overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`listing-note-title-${listing.id}`}
          onClick={closeNote}
        >
          <div style={dialogCard} onClick={event => event.stopPropagation()}>
            <h2
              id={`listing-note-title-${listing.id}`}
              style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}
            >
              {actionLabel(noteAction)} {title}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-3)' }}>
              {noteAction === 'reject'
                ? 'The company sees this note and can fix the listing before resubmitting it.'
                : 'The company sees this note. The listing is hidden from renters while suspended.'}
            </p>
            <textarea
              autoFocus
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={4}
              placeholder="Note for the company…"
              disabled={busy !== null}
              style={textareaStyle}
            />
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                marginTop: 12,
              }}
            >
              <button
                type="button"
                disabled={busy !== null}
                onClick={closeNote}
                style={buttonStyle(false, false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy !== null || !note.trim()}
                aria-busy={busy === noteAction}
                onClick={() => noteAction && void run(noteAction, note.trim())}
                style={buttonStyle(true, false)}
              >
                {busy === noteAction ? busyLabel(noteAction) : actionLabel(noteAction)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function buttonStyle(danger: boolean, primary: boolean): CSSProperties {
  if (primary) {
    return {
      border: '1px solid #0F766E',
      background: '#0F766E',
      color: '#fff',
      borderRadius: 10,
      padding: '8px 12px',
      fontWeight: 700,
      fontSize: 13,
      cursor: 'pointer',
    }
  }
  return {
    border: `1px solid ${danger ? '#FECACA' : 'var(--border)'}`,
    background: danger ? '#FEF2F2' : 'var(--surface)',
    color: danger ? '#B91C1C' : 'var(--text-2)',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  }
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
}

const dialogCard: CSSProperties = {
  width: '100%',
  maxWidth: 460,
  background: 'var(--surface)',
  borderRadius: 16,
  padding: '20px 20px',
  border: '1px solid var(--border)',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: 10,
  fontSize: 13,
  color: 'var(--text)',
  resize: 'vertical',
  boxSizing: 'border-box',
}
