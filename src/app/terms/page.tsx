import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const terms = [
  'Use the app in a lawful and responsible manner.',
  'Do not upload or share illegal, harmful, or misleading content.',
  'Respect other users, merchants, and service providers.',
  'Merchants are responsible for the accuracy of their products and services.',
  'Vero360 acts as a technology platform and is not the direct provider of services.',
]

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div style={{
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
        padding: '48px 24px 64px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <Logo height={44} textColor="#fff" />
          </div>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500,
            marginBottom: 32,
          }}>
            ← Back to home
          </Link>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.5px', fontFamily: 'var(--font-display)',
          }}>
            Terms &amp; Conditions
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '-32px auto 0', padding: '0 24px 80px' }}>
        <article style={{
          background: '#fff', borderRadius: 20,
          border: '1px solid var(--border)',
          padding: '40px 36px',
          boxShadow: 'var(--shadow)',
        }}>
          <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 28 }}>
            By using Vero360, you agree to the following terms:
          </p>

          <ul style={{ paddingLeft: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {terms.map(item => (
              <li key={item} style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {item}
              </li>
            ))}
          </ul>

          <p style={{
            fontSize: 15, color: 'var(--error)', lineHeight: 1.8,
            background: 'rgba(239,68,68,0.06)', borderRadius: 12,
            padding: '16px 18px', border: '1px solid rgba(239,68,68,0.2)',
            marginBottom: 28,
          }}>
            The system holds money until both parties are satisfied with the business.
          </p>

          <a
            href="/legal/Vero360_Merchant_Terms_Conditions.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 15,
              fontWeight: 600,
              color: '#EA580C',
              textDecoration: 'none',
            }}
          >
            Read more →
          </a>
        </article>
      </div>
    </main>
  )
}
