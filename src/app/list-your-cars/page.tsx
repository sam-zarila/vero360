import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Navbar from '@/app/components/landing/navbar'
import Footer from '@/app/components/landing/Footer '
import { APP_STORE_URL, PLAY_STORE_URL } from '@/app/components/landing/veroServices'
import LeadForm from './LeadForm'

/**
 * Contact fallbacks live here, in one place. Override on the server with
 * CAR_HIRE_LEADS_EMAIL and NEXT_PUBLIC_CAR_HIRE_PHONE — do not hardcode
 * personal addresses or numbers anywhere else.
 */
const PARTNERS_EMAIL =
  process.env.CAR_HIRE_LEADS_EMAIL?.trim() || 'partners@vero360.app'
const PARTNERS_PHONE = process.env.NEXT_PUBLIC_CAR_HIRE_PHONE?.trim() || '+265 999 000 000'
const PARTNERS_TEL = `tel:${PARTNERS_PHONE.replace(/[^\d+]/g, '')}`

const TITLE = 'List your cars on Vero360 · Car hire partnerships'
const DESCRIPTION =
  'Own a car hire company or a few vehicles? List them on Vero360, get bookings from verified renters and manage payments in one account. Apply in the app or request a callback.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://vero360.app/list-your-cars' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://vero360.app/list-your-cars',
    siteName: 'Vero360',
    type: 'website',
  },
}

const BENEFITS: Array<{ title: string; body: string }> = [
  {
    title: 'One account for the whole fleet',
    body: 'Company details, branches, vehicles and bookings stay in one place — no spreadsheets or phone books.',
  },
  {
    title: 'Renters are verified',
    body: 'Bookings come through the Vero360 app, where renter accounts and eligibility are checked before pickup.',
  },
  {
    title: 'Payments and bookings managed',
    body: 'See upcoming rentals, deposits and payouts, and keep availability current from the app.',
  },
  {
    title: 'Built for Malawi roads',
    body: 'List sedans, SUVs, pickups and minibuses with the documents renters and operations both need.',
  },
]

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Apply in the app',
    body: 'Create a partner account in Vero360 and choose Car hire. Companies and individual owners both apply there.',
  },
  {
    title: 'Vero360 reviews the company',
    body: 'A person on our team checks your registration (or national ID), contact details and payout information.',
  },
  {
    title: 'Add vehicles with documents',
    body: 'For each car, upload registration, insurance and roadworthiness documents, then set your rate and service area.',
  },
  {
    title: 'Every vehicle is verified before it goes live',
    body: 'Each car is checked individually. Once approved, it appears to renters and can start taking bookings.',
  },
]

const CHECKLIST: string[] = [
  'Company name — or your own name if you are an individual owner',
  'A contact phone number we can reach you on',
  'The cities or routes you want to serve',
  'Business registration number (companies) or national ID (individuals)',
  'TPIN, if you have one',
  'Payout details for the bookings you accept',
  'Vehicle documents: registration, insurance and roadworthiness',
]

export default function ListYourCarsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <Navbar />

      <section
        style={{
          background: 'linear-gradient(135deg, #9A3412 0%, #F97316 48%, #EA580C 100%)',
          padding: '118px 24px 64px',
          color: '#fff',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            Car hire partnerships
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 900,
              letterSpacing: '-0.8px',
              fontFamily: 'var(--font-display)',
              maxWidth: 780,
              lineHeight: 1.05,
            }}
          >
            Put your cars to work on Vero360
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              maxWidth: 640,
              fontSize: 17,
              lineHeight: 1.65,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            Car hire companies and individual owners list their vehicles on Vero360 and get
            bookings from renters across Malawi. One account, verified renters, and bookings you
            can manage from your phone.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={primaryStoreButton}
            >
              Get the app on Google Play
            </a>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={primaryStoreButton}
            >
              Download on the App Store
            </a>
          </div>

          <p style={{ margin: '16px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
            Prefer to talk first?{' '}
            <a href="#apply" style={heroInlineLink}>
              Request a callback
            </a>{' '}
            or email{' '}
            <a href={`mailto:${PARTNERS_EMAIL}`} style={heroInlineLink}>
              {PARTNERS_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 80px' }}>
        <section
          style={{
            marginTop: -32,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14,
          }}
        >
          {BENEFITS.map(benefit => (
            <div key={benefit.title} style={benefitCard}>
              <h2 style={benefitTitle}>{benefit.title}</h2>
              <p style={benefitBody}>{benefit.body}</p>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 64 }}>
          <SectionHeading
            eyebrow="How it works"
            title="From application to first booking"
            body="Review is human, and every vehicle is checked. Here is the real flow once you start."
          />
          <ol style={stepList}>
            {STEPS.map((step, index) => (
              <li key={step.title} style={stepItem}>
                <span style={stepNumber}>{index + 1}</span>
                <div>
                  <h3 style={stepTitle}>{step.title}</h3>
                  <p style={stepBody}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p style={callout}>
            Every company and every vehicle is reviewed by a person before it goes live. If
            documents are missing or expired, the vehicle stays hidden until they are fixed.
          </p>
        </section>

        <section
          className="list-cars-split"
          style={{
            marginTop: 64,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
            gap: 22,
            alignItems: 'start',
          }}
        >
          <div style={panelCard}>
            <SectionHeading
              eyebrow="Before you apply"
              title="What you will need"
              body="Have these ready so the application does not stall. You can start without every item, but review needs them all."
            />
            <ul style={checklist}>
              {CHECKLIST.map(item => (
                <li key={item} style={checklistItem}>
                  <span aria-hidden style={checkMark}>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={contactCard}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              Prefer to talk first?
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.65, color: 'var(--text-2)' }}>
              Call or email partnerships and we will walk you through the application before you
              install anything.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <a href={PARTNERS_TEL} style={contactLink}>
                {PARTNERS_PHONE}
              </a>
              <a href={`mailto:${PARTNERS_EMAIL}`} style={contactLink}>
                {PARTNERS_EMAIL}
              </a>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Weekdays, 08:00–17:00. If the line is busy, leave your details below and we will
              call you back.
            </p>
          </div>
        </section>

        <section id="apply" style={{ marginTop: 64, scrollMarginTop: 90 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <LeadForm />
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        @media (max-width: 820px) {
          .list-cars-split {
            grid-template-columns: 1fr !important;
          }
        }
        #apply {
          scroll-margin-top: 90px;
        }
      `}</style>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h2
        style={{
          margin: '6px 0 0',
          fontSize: 'clamp(24px, 3.4vw, 34px)',
          fontWeight: 900,
          letterSpacing: '-0.4px',
          fontFamily: 'var(--font-display)',
          color: 'var(--text)',
        }}
      >
        {title}
      </h2>
      <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.65, color: 'var(--text-3)' }}>
        {body}
      </p>
    </div>
  )
}

const primaryStoreButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '15px 24px',
  borderRadius: 14,
  background: '#fff',
  color: '#9A3412',
  fontSize: 16,
  fontWeight: 800,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 10px 24px rgba(120, 53, 15, 0.24)',
  minWidth: 250,
}

const heroInlineLink: CSSProperties = {
  color: '#fff',
  fontWeight: 800,
  textDecoration: 'underline',
}

const benefitCard: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: '20px 18px',
  boxShadow: '0 12px 28px rgba(17, 24, 39, 0.06)',
}

const benefitTitle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  fontFamily: 'var(--font-display)',
  color: 'var(--text)',
}

const benefitBody: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--text-3)',
}

const stepList: CSSProperties = {
  listStyle: 'none',
  margin: '22px 0 0',
  padding: 0,
  display: 'grid',
  gap: 14,
}

const stepItem: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 14,
  alignItems: 'start',
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '16px 18px',
}

const stepNumber: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  background: 'linear-gradient(135deg, #EA580C, #F97316)',
  color: '#fff',
  fontWeight: 900,
  fontSize: 18,
  display: 'grid',
  placeItems: 'center',
}

const stepTitle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 800,
  fontFamily: 'var(--font-display)',
  color: 'var(--text)',
}

const stepBody: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--text-2)',
}

const callout: CSSProperties = {
  margin: '18px 0 0',
  padding: '14px 16px',
  borderRadius: 14,
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
  color: '#9A3412',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 600,
}

const panelCard: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: '24px 22px',
}

const checklist: CSSProperties = {
  listStyle: 'none',
  margin: '18px 0 0',
  padding: 0,
  display: 'grid',
  gap: 12,
}

const checklistItem: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  fontSize: 14,
  lineHeight: 1.55,
  color: 'var(--text-2)',
}

const checkMark: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 7,
  background: '#ECFDF5',
  border: '1px solid #A7F3D0',
  color: '#047857',
  fontSize: 13,
  fontWeight: 900,
  display: 'grid',
  placeItems: 'center',
  marginTop: 1,
}

const contactCard: CSSProperties = {
  background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
  border: '1px solid #FED7AA',
  borderRadius: 20,
  padding: '24px 22px',
}

const contactLink: CSSProperties = {
  display: 'block',
  padding: '12px 14px',
  borderRadius: 12,
  background: '#fff',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 800,
  textDecoration: 'none',
}

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: '#EA580C',
}
