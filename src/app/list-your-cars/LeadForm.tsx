'use client'

import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

type LeadType = 'BUSINESS' | 'INDIVIDUAL'

type Values = {
  companyName: string
  contactName: string
  email: string
  phone: string
  type: LeadType
  city: string
  fleetSize: string
  message: string
  website: string
}

type Errors = Partial<Record<keyof Values | 'form', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const EMPTY: Values = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  type: 'BUSINESS',
  city: '',
  fleetSize: '',
  message: '',
  website: '',
}

function validate(values: Values): Errors {
  const errors: Errors = {}
  if (!values.companyName.trim()) {
    errors.companyName = 'Add your company name, or your own name if you are an individual owner.'
  }
  if (!values.contactName.trim()) {
    errors.contactName = 'Tell us who we should speak to.'
  }
  if (!values.email.trim()) {
    errors.email = 'Add an email address so partnerships can reply.'
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = 'That email address does not look right.'
  }
  if (!values.phone.trim()) {
    errors.phone = 'Add a phone number so we can call you back.'
  }
  if (values.fleetSize.trim()) {
    const size = Number(values.fleetSize)
    if (!Number.isInteger(size) || size < 0 || size > 5000) {
      errors.fleetSize = 'Enter a whole number between 0 and 5000.'
    }
  }
  if (values.message.length > 2000) {
    errors.message = 'Keep the message under 2000 characters.'
  }
  return errors
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} role="alert" style={errorTextStyle}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export default function LeadForm() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      if (!prev[key] && !prev.form) return prev
      const next = { ...prev }
      delete next[key]
      delete next.form
      return next
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return

    // Honeypot: real people never fill this. Quietly pretend it worked.
    if (values.website.trim()) {
      setDone(true)
      return
    }

    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSending(true)
    try {
      const res = await fetch('/api/public/car-hire-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          companyName: values.companyName.trim(),
          contactName: values.contactName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          type: values.type,
          city: values.city.trim(),
          fleetSize: values.fleetSize.trim(),
          message: values.message.trim(),
          website: values.website,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'We could not send your request. Please try again.'
        setErrors({ form: message })
        return
      }
      setDone(true)
    } catch {
      setErrors({ form: 'We could not reach the server. Check your connection and try again.' })
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div role="status" style={successCard}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
          Thanks — our partnerships team will call you within one business day
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--text-2)' }}>
          Keep your phone nearby. If you already use the Vero360 app, you can also start the
          company application there while you wait.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate style={formCard}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
          Request a callback
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-3)' }}>
          Leave your details and partnerships will call you. No app install needed to start the
          conversation.
        </p>
      </div>

      {errors.form ? (
        <div role="alert" style={formErrorStyle}>
          {errors.form}
        </div>
      ) : null}

      <div className="lead-form-grid" style={gridStyle}>
        <Field id="lead-company" label="Company name" error={errors.companyName}>
          <input
            id="lead-company"
            name="companyName"
            value={values.companyName}
            onChange={event => update('companyName', event.target.value)}
            maxLength={160}
            autoComplete="organization"
            placeholder="Acme Car Hire"
            aria-invalid={Boolean(errors.companyName)}
            aria-describedby={errors.companyName ? 'lead-company-error' : undefined}
            style={inputStyle}
          />
        </Field>

        <Field id="lead-contact" label="Your name" error={errors.contactName}>
          <input
            id="lead-contact"
            name="contactName"
            value={values.contactName}
            onChange={event => update('contactName', event.target.value)}
            maxLength={120}
            autoComplete="name"
            placeholder="Ada Phiri"
            aria-invalid={Boolean(errors.contactName)}
            aria-describedby={errors.contactName ? 'lead-contact-error' : undefined}
            style={inputStyle}
          />
        </Field>

        <Field id="lead-email" label="Email" error={errors.email}>
          <input
            id="lead-email"
            name="email"
            type="email"
            value={values.email}
            onChange={event => update('email', event.target.value)}
            maxLength={160}
            autoComplete="email"
            placeholder="you@company.mw"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'lead-email-error' : undefined}
            style={inputStyle}
          />
        </Field>

        <Field id="lead-phone" label="Phone" error={errors.phone}>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            value={values.phone}
            onChange={event => update('phone', event.target.value)}
            maxLength={40}
            autoComplete="tel"
            placeholder="+265 999 000 000"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'lead-phone-error' : undefined}
            style={inputStyle}
          />
        </Field>

        <Field id="lead-city" label="City or service area" hint="Optional">
          <input
            id="lead-city"
            name="city"
            value={values.city}
            onChange={event => update('city', event.target.value)}
            maxLength={120}
            placeholder="Lilongwe, Blantyre…"
            style={inputStyle}
          />
        </Field>

        <Field id="lead-fleet" label="Fleet size" hint="Optional — how many cars you could list" error={errors.fleetSize}>
          <input
            id="lead-fleet"
            name="fleetSize"
            type="number"
            inputMode="numeric"
            min={0}
            max={5000}
            value={values.fleetSize}
            onChange={event => update('fleetSize', event.target.value)}
            placeholder="4"
            aria-invalid={Boolean(errors.fleetSize)}
            aria-describedby={errors.fleetSize ? 'lead-fleet-error' : undefined}
            style={inputStyle}
          />
        </Field>
      </div>

      <fieldset style={fieldsetStyle}>
        <legend style={labelStyle}>I am applying as</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 8 }}>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="lead-type"
              value="BUSINESS"
              checked={values.type === 'BUSINESS'}
              onChange={() => update('type', 'BUSINESS')}
              style={radioStyle}
            />
            A company
          </label>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="lead-type"
              value="INDIVIDUAL"
              checked={values.type === 'INDIVIDUAL'}
              onChange={() => update('type', 'INDIVIDUAL')}
              style={radioStyle}
            />
            An individual owner
          </label>
        </div>
      </fieldset>

      <Field id="lead-message" label="Anything we should know?" hint="Optional" error={errors.message}>
        <textarea
          id="lead-message"
          name="message"
          value={values.message}
          onChange={event => update('message', event.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="How many cars, which areas, and when you would like to start."
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'lead-message-error' : undefined}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <div aria-hidden="true" style={honeypotStyle}>
        <label htmlFor="lead-website">Website</label>
        <input
          id="lead-website"
          name="website"
          value={values.website}
          onChange={event => update('website', event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="submit" disabled={sending} style={submitStyle}>
          {sending ? 'Sending…' : 'Request a callback'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          We only use these details to contact you about listing cars.
        </span>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .lead-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </form>
  )
}

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-2)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
}

const radioStyle: CSSProperties = {
  width: 16,
  height: 16,
  accentColor: 'var(--primary)',
}

const radioLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: 'var(--text-2)',
  fontWeight: 600,
}

const fieldsetStyle: CSSProperties = {
  border: 'none',
  margin: 0,
  padding: 0,
  minWidth: 0,
}

const formCard: CSSProperties = {
  display: 'grid',
  gap: 18,
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: '26px 24px',
  boxShadow: '0 16px 40px rgba(154, 52, 18, 0.08)',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
}

const errorTextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#B91C1C',
}

const formErrorStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  color: '#B91C1C',
  fontSize: 13,
  fontWeight: 600,
}

const successCard: CSSProperties = {
  display: 'grid',
  gap: 4,
  background: '#ECFDF5',
  border: '1px solid #A7F3D0',
  borderRadius: 20,
  padding: '28px 26px',
}

const submitStyle: CSSProperties = {
  padding: '13px 22px',
  borderRadius: 12,
  border: '1px solid var(--primary-dark)',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
  opacity: 1,
}

const honeypotStyle: CSSProperties = {
  position: 'absolute',
  left: -9999,
  top: 'auto',
  width: 1,
  height: 1,
  overflow: 'hidden',
}
