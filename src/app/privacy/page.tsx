import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const dataCollected = [
  'Basic account details such as name, email, phone number, and address.',
  'Google and Apple login and authentication data.',
  'Location data (precise and approximate), when you grant permission, for ride sharing, bike rides, courier delivery, maps, nearby services, and to show relevant local content.',
  'Order, booking, and service history for app functionality.',
  'Chat messages required for communication between users and merchants.',
  'App usage data for performance and security improvements.',
  'Device information such as device type, operating system, and app version for security and troubleshooting.',
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
          <p style={{
            marginTop: 12,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            fontWeight: 500,
          }}>
            Last updated: September 19, 2026
          </p>
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
            This Privacy Policy explains what data we collect, how we use it, and your choices.
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

          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, fontFamily: 'var(--font-display)' }}>
            Location data
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 14 }}>
            Vero360 accesses LOCATION data on your device when you allow it. We use location to:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
              Match passengers with nearby drivers and track trips for Vero Ride and Vero Bike.
            </li>
            <li style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
              Support courier pickup and delivery, maps, and nearby marketplace, food, and stay listings.
            </li>
            <li style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
              Improve safety and service quality during active rides (including foreground location updates while a trip is in progress).
            </li>
          </ul>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 28 }}>
            Location access is requested through your device permission prompts. You can deny or revoke location
            permission in your device settings; some features (such as ride sharing and nearby services) may not
            work fully without it. We do not sell your location data.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, fontFamily: 'var(--font-display)' }}>
            How we use your data
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 28 }}>
            We use collected data to provide and improve Vero360 services, process orders and bookings,
            enable messaging between users and merchants, personalize nearby content, prevent fraud,
            and comply with legal obligations. We do not sell or rent your personal data. Payments are
            handled securely by trusted third-party providers, and Vero360 does not store your payment credentials.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, fontFamily: 'var(--font-display)' }}>
            Your rights
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 28 }}>
            You may clear cached data, update your information, manage app permissions (including location),
            or request account deletion at any time through the Settings section of the app.
            For privacy questions or deletion requests, contact us at{' '}
            <a href="mailto:info@vero360.app" style={{ color: '#EA580C', fontWeight: 600 }}>
              info@vero360.app
            </a>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href="/legal/Vero360_Privacy_Policy.pdf"
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
              Read more: Privacy Policy →
            </a>
            <a
              href="/legal/Vero360_Platform_Agreement_Policy.pdf"
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
              Read more: Platform Agreement →
            </a>
          </div>
        </article>
      </div>
    </main>
  )
}
