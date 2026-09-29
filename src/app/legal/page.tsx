import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const documents = [
  {
    title: 'Platform Agreement & Policy',
    subtitle: 'Vero360 platform agreement',
    href: '/legal/Vero360_Platform_Agreement_Policy.pdf',
  },
  {
    title: 'Privacy Policy',
    subtitle: 'How we collect and use your data',
    href: '/legal/Vero360_Privacy_Policy.pdf',
  },
  {
    title: 'Merchant Terms & Conditions',
    subtitle: 'Terms for merchants on Vero360',
    href: '/legal/Vero360_Merchant_Terms_Conditions.pdf',
  },
  {
    title: 'Cybersecurity & Fraud Prevention',
    subtitle: 'Customer protection policy',
    href: '/legal/Vero360_Cybersecurity_Fraud_Prevention_Customer_Protection_Policy.pdf',
  },
  {
    title: 'Refund Policy',
    subtitle: 'How refunds work on Vero360',
    href: '/legal/Vero360_Refund_Policy.pdf',
  },
  {
    title: 'Subscription & Payment Policy',
    subtitle: 'Subscription and payment terms',
    href: '/legal/Vero360_Subscription_Payment_Policy_v2.pdf',
  },
]

export default function LegalDocumentsPage() {
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
            Legal documents
          </h1>
          <p style={{
            marginTop: 12,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            fontWeight: 500,
          }}>
            Official Vero360 policies (PDF)
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '-32px auto 0', padding: '0 24px 80px' }}>
        <article style={{
          background: '#fff', borderRadius: 20,
          border: '1px solid var(--border)',
          padding: '32px 28px',
          boxShadow: 'var(--shadow)',
        }}>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
            Tap a document to open the full PDF. Summaries are also available on{' '}
            <Link href="/privacy" style={{ color: '#EA580C', fontWeight: 600 }}>Privacy</Link>
            {' '}and{' '}
            <Link href="/terms" style={{ color: '#EA580C', fontWeight: 600 }}>Terms</Link>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {documents.map((doc) => (
              <a
                key={doc.href}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: '#FFF8F0',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(234, 88, 12, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#EA580C',
                  fontWeight: 800,
                  fontSize: 12,
                }}>
                  PDF
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: 'var(--text)',
                    marginBottom: 2,
                  }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {doc.subtitle}
                  </div>
                </div>
                <span style={{ color: '#EA580C', fontWeight: 700, fontSize: 13 }}>
                  Open →
                </span>
              </a>
            ))}
          </div>
        </article>
      </div>
    </main>
  )
}
