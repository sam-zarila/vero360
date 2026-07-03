import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const dataCollected = [
  'Basic account details such as name, email, phone number, and address.',
  'Google and Apple login and authentication data.',
  'Order, booking, and service history for app functionality.',
  'Chat messages required for communication between users and merchants.',
  'App usage data for performance and security improvements.',
]

export default function PrivacyPage() {
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
            Privacy Policy
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
            Your privacy matters to us. Vero360 collects only the information necessary to operate and improve the app.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, fontFamily: 'var(--font-display)' }}>
            Data collected
          </h2>
          <ul style={{ paddingLeft: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dataCollected.map(item => (
              <li key={item} style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {item}
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 28 }}>
            We do not sell or rent your personal data. Payments are handled securely by trusted third-party
            providers, and Vero360 does not store your payment credentials.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, fontFamily: 'var(--font-display)' }}>
            Your rights
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8 }}>
            You may clear cached data, update your information, or request account deletion at any time
            through the Settings section.
          </p>
        </article>
      </div>
    </main>
  )
}
