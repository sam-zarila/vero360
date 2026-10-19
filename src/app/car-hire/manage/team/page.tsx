'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  carHireStatusTone,
  prettyStatus,
  type OperatorSummary,
} from '@/lib/car-hire'
import {
  getMyOperators,
  inviteMember,
  ProviderApiError,
  revokeMember,
} from '@/lib/car-hire-owner-api'
import { formatDateTime } from '@/lib/vero-api'
import { useProviderAuth } from '../components/ProviderShell'
import CompanyProfileForm from './CompanyProfileForm'
import {
  ProviderCard,
  ProviderEmpty,
  ProviderError,
  ProviderLoading,
  ProviderNotice,
  ProviderPageHeading,
  StatusBadge,
  dangerButton,
  ghostButton,
  inputStyle,
  labelStyle,
  primaryButton,
} from '../components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'error'

type InviteDraft = {
  email: string
  permissions: string[]
}

const PERMISSIONS: { id: string; label: string; hint: string }[] = [
  { id: 'fleet.manage', label: 'Fleet', hint: 'Add vehicles and block dates' },
  { id: 'bookings.view', label: 'View bookings', hint: 'See booking requests and rentals' },
  { id: 'bookings.manage', label: 'Manage bookings', hint: 'Confirm, reject, and hand over' },
  { id: 'calendar.manage', label: 'Calendar', hint: 'Manage availability and blocks' },
  { id: 'team.manage', label: 'Team', hint: 'Invite and remove team members' },
  { id: 'performance.view', label: 'Performance', hint: 'See analytics and revenue' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emptyInviteDraft(): InviteDraft {
  return { email: '', permissions: [] }
}

function teamActionError(err: unknown): string {
  if (err instanceof ProviderApiError) {
    if (err.status === 401) return 'Your session expired. Sign out and sign in again.'
    if (err.status === 403) {
      return 'Your membership does not allow team changes. Ask the operator owner for the team.manage permission.'
    }
    if (err.status === 404) return 'That member or operator was not found. Refresh and try again.'
    if (err.status === 409) {
      return 'This member or invitation already exists. Refresh before retrying.'
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'The action could not be completed.'
}

export default function ProviderTeamPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [operators, setOperators] = useState<OperatorSummary[]>([])
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  const [drafts, setDrafts] = useState<Record<string, InviteDraft>>({})
  const [revokeDrafts, setRevokeDrafts] = useState<Record<string, string>>({})
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    setForbidden(false)
    try {
      const rows = await getMyOperators()
      setOperators(rows)
      setState('ready')
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) setSessionExpired(true)
      if (err instanceof ProviderApiError && (err.status === 403 || err.status === 404)) {
        setForbidden(true)
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your operator memberships. Please try again.',
      )
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function draftFor(operatorId: string): InviteDraft {
    return drafts[operatorId] ?? emptyInviteDraft()
  }

  function updateDraft(operatorId: string, next: InviteDraft) {
    setDrafts(previous => ({ ...previous, [operatorId]: next }))
  }

  async function runInvite(operator: OperatorSummary) {
    const draft = draftFor(operator.id)
    const email = draft.email.trim()
    if (!EMAIL_PATTERN.test(email)) {
      setActionError('Enter a valid email address for the person you are inviting.')
      return
    }
    setBusy(`invite-${operator.id}`)
    setActionError('')
    setNotice('')
    try {
      const invitation = await inviteMember(operator.id, {
        email,
        permissions: draft.permissions,
      })
      const invitedEmail = invitation?.email || email
      setNotice(
        invitation?.expiresAt
          ? `Invitation created for ${invitedEmail}. It expires ${formatDateTime(invitation.expiresAt)}.`
          : `Invitation created for ${invitedEmail}. The invited person accepts it from their Vero360 account.`,
      )
      updateDraft(operator.id, { email: '', permissions: draft.permissions })
      await load()
    } catch (err) {
      setActionError(teamActionError(err))
    } finally {
      setBusy('')
    }
  }

  async function runRevoke(operator: OperatorSummary) {
    const userId = (revokeDrafts[operator.id] ?? '').trim()
    if (!userId) {
      setActionError('Enter the member user ID before removing access.')
      return
    }
    setBusy(`revoke-${operator.id}`)
    setActionError('')
    setNotice('')
    try {
      await revokeMember(operator.id, userId)
      setNotice(
        `Member ${userId} was removed from ${operator.displayName}. Reloaded from the backend.`,
      )
      setRevokeDrafts(previous => ({ ...previous, [operator.id]: '' }))
      setRevokeConfirm(null)
      await load()
    } catch (err) {
      setActionError(teamActionError(err))
    } finally {
      setBusy('')
    }
  }

  const heading = (
    <ProviderPageHeading
      eyebrow="Provider workspace"
      title="Team"
      description="Membership roles and permissions for your approved operator. Invitations and removals are authorised by the backend on every request."
      actions={
        <button type="button" onClick={() => void load()} style={ghostButton}>
          Refresh
        </button>
      }
    />
  )

  if (state === 'loading') {
    return (
      <>
        {heading}
        <ProviderLoading label="Loading operator memberships…" />
      </>
    )
  }

  if (state === 'error') {
    return (
      <>
        {heading}
        <ProviderError
          message={
            forbidden
              ? 'This Vero360 account is not authorised to view team membership for a car-hire operator yet. Ask the operator owner to invite your Vero360 email.'
              : sessionExpired
                ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
                : error || 'Could not load your operator memberships.'
          }
          onRetry={() => void load()}
          action={
            sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : (
              <Link href="/car-hire/manage/bookings" style={ghostButton}>
                Open bookings
              </Link>
            )
          }
        />
      </>
    )
  }

  return (
    <>
      {heading}

      {notice ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="success">{notice}</ProviderNotice>
        </div>
      ) : null}

      {actionError ? (
        <div style={{ marginBottom: 14 }} role="alert">
          <ProviderNotice tone="error">{actionError}</ProviderNotice>
        </div>
      ) : null}

      {operators.length === 0 ? (
        <ProviderEmpty
          title="No operator membership found"
          body="Team management is available to approved car-hire owners, businesses, and invited staff. Ask the operator owner to invite your existing Vero360 email, or apply in the Vero360 app. This page never creates a second account."
          action={
            <Link href="/car-hire" style={ghostButton}>
              Browse car hire
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {operators.map(operator => {
            const active = operator.status === 'ACTIVE'
            const membership = operator.membership
            const draft = draftFor(operator.id)
            const revokeUserId = revokeDrafts[operator.id] ?? ''
            const confirmingRevoke = revokeConfirm === operator.id

            return (
              <ProviderCard key={operator.id}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: '-0.3px' }}>
                      {operator.displayName}
                    </h2>
                    <p style={{ ...smallMeta, marginTop: 4 }}>
                      {operator.type ? `${prettyStatus(operator.type)} · ` : ''}Operator ID:{' '}
                      {operator.id}
                    </p>
                  </div>
                  <StatusBadge
                    tone={carHireStatusTone(operator.status)}
                    label={prettyStatus(operator.status)}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    marginTop: 12,
                    padding: '11px 12px',
                    borderRadius: 11,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={metaLabel}>Membership role</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>
                      {membership?.role ? prettyStatus(membership.role) : '—'}
                    </span>
                    {membership?.status ? (
                      <span style={smallMeta}>· {prettyStatus(membership.status)}</span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={metaLabel}>Permissions</span>
                    {membership && membership.permissions.length > 0 ? (
                      membership.permissions.map(permission => (
                        <span key={`${operator.id}-${permission}`} style={chip}>
                          {permission}
                        </span>
                      ))
                    ) : (
                      <span style={smallMeta}>
                        No permissions listed. The backend enforces what this membership can do.
                      </span>
                    )}
                  </div>
                </div>

                {operator.reviewerNote && operator.status !== 'ACTIVE' ? (
                  <div style={{ marginTop: 12 }}>
                    <ProviderNotice tone="warn">
                      Vero360 review note: {operator.reviewerNote}
                    </ProviderNotice>
                  </div>
                ) : null}

                {membership?.role === 'OWNER' ||
                membership?.permissions.includes('team.manage') ? (
                  <CompanyProfileForm
                    key={`${operator.id}-${operator.displayName}-${operator.logoUrl ?? ''}`}
                    operator={operator}
                    onSaved={message => {
                      setNotice(message)
                      void load()
                    }}
                  />
                ) : null}

                {active ? (
                  <>
                    <form
                      onSubmit={(event: FormEvent<HTMLFormElement>) => {
                        event.preventDefault()
                        void runInvite(operator)
                      }}
                      style={formBlock}
                    >
                      <div>
                        <h3 style={subTitle}>Invite a team member</h3>
                        <p style={{ ...smallMeta, marginTop: 4 }}>
                          The backend creates the invitation for this email. Choose only the
                          permissions the person needs.
                        </p>
                      </div>

                      <div style={{ maxWidth: 420 }}>
                        <label htmlFor={`invite-email-${operator.id}`} style={labelStyle}>
                          Email
                        </label>
                        <input
                          id={`invite-email-${operator.id}`}
                          type="email"
                          autoComplete="off"
                          value={draft.email}
                          onChange={event =>
                            updateDraft(operator.id, { ...draft, email: event.target.value })
                          }
                          disabled={busy !== ''}
                          placeholder="staff@example.com"
                          style={inputStyle}
                        />
                      </div>

                      <fieldset style={fieldset}>
                        <legend style={legend}>Permissions</legend>
                        <div style={checkGrid}>
                          {PERMISSIONS.map(permission => (
                            <label
                              key={permission.id}
                              htmlFor={`permission-${operator.id}-${permission.id}`}
                              title={permission.hint}
                              style={checkboxLabel}
                            >
                              <input
                                id={`permission-${operator.id}-${permission.id}`}
                                type="checkbox"
                                checked={draft.permissions.includes(permission.id)}
                                onChange={event => {
                                  const permissions = event.target.checked
                                    ? [...draft.permissions, permission.id]
                                    : draft.permissions.filter(id => id !== permission.id)
                                  updateDraft(operator.id, { ...draft, permissions })
                                }}
                                disabled={busy !== ''}
                              />
                              {permission.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div>
                        <button type="submit" disabled={busy !== ''} style={primaryButton}>
                          {busy === `invite-${operator.id}`
                            ? 'Sending invitation…'
                            : 'Send invitation'}
                        </button>
                      </div>
                    </form>

                    <div style={formBlock}>
                      <div>
                        <h3 style={subTitle}>Remove a member</h3>
                        <p style={{ ...smallMeta, marginTop: 4 }}>
                          The API does not list individual members here. Enter the member&apos;s
                          Vero360 user ID; the backend verifies your team.manage permission.
                        </p>
                      </div>

                      <div style={{ maxWidth: 420 }}>
                        <label htmlFor={`revoke-member-${operator.id}`} style={labelStyle}>
                          Member user ID
                        </label>
                        <input
                          id={`revoke-member-${operator.id}`}
                          value={revokeUserId}
                          onChange={event =>
                            setRevokeDrafts(previous => ({
                              ...previous,
                              [operator.id]: event.target.value,
                            }))
                          }
                          disabled={busy !== ''}
                          placeholder="e.g. 8f2c1a4e-…"
                          style={inputStyle}
                        />
                      </div>

                      {confirmingRevoke ? (
                        <div style={confirmBox}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              lineHeight: 1.55,
                              color: '#991B1B',
                              fontWeight: 700,
                            }}
                          >
                            Remove {revokeUserId || 'this member'} from {operator.displayName}?
                            They lose workspace access immediately.
                          </p>
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                            <button
                              type="button"
                              onClick={() => void runRevoke(operator)}
                              disabled={busy !== ''}
                              style={dangerButton}
                            >
                              {busy === `revoke-${operator.id}`
                                ? 'Removing…'
                                : 'Yes, remove member'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevokeConfirm(null)}
                              disabled={busy !== ''}
                              style={ghostButton}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!revokeUserId.trim()) {
                                setActionError('Enter the member user ID before removing access.')
                                return
                              }
                              setActionError('')
                              setRevokeConfirm(operator.id)
                            }}
                            disabled={busy !== ''}
                            style={ghostButton}
                          >
                            Review removal
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 14 }}>
                    <ProviderNotice tone="warn">
                      This operator is {prettyStatus(operator.status) || 'not active'} rather than
                      ACTIVE. Team invitations and member removal unlock once the operator profile
                      is approved. Applications are reviewed in the Vero360 app; this page never
                      creates a second account.
                    </ProviderNotice>
                  </div>
                )}
              </ProviderCard>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <ProviderNotice tone="info">
          Roles and permissions are enforced by the backend. This page never grants access locally,
          and a pending operator cannot invite staff until it is active.
        </ProviderNotice>
      </div>
    </>
  )
}

const smallMeta = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--text-3)',
} as const

const metaLabel = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: 'var(--text-4)',
} as const

const chip = {
  display: 'inline-flex',
  padding: '3px 8px',
  borderRadius: 999,
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
  color: '#9A3412',
  fontSize: 11,
  fontWeight: 800,
} as const

const subTitle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: '-0.2px',
} as const

const formBlock = {
  display: 'grid',
  gap: 10,
  marginTop: 14,
  paddingTop: 14,
  borderTop: '1px solid var(--border)',
} as const

const fieldset = {
  border: '1px solid var(--border)',
  borderRadius: 11,
  padding: '9px 12px 11px',
  margin: 0,
} as const

const legend = {
  padding: '0 4px',
  fontSize: 11,
  fontWeight: 900,
  color: 'var(--text-3)',
} as const

const checkGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 8,
  marginTop: 4,
} as const

const checkboxLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-2)',
} as const

const confirmBox = {
  padding: 11,
  borderRadius: 11,
  border: '1px solid #FECACA',
  background: '#FFF7F7',
} as const
