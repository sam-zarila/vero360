import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const CERT_PDF = '/legal/COY-J7RCG5G-Company-Registration-Certificate.pdf'

export default function CompanyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div
        style={{
          background:
            'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
          padding: '48px 24px 64px',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <Logo height={44} textColor="#fff" />
          </div>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: 'rgba(255,255,255,.85)',
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 32,
            }}
          >
            ← Back to home
          </Link>

          <h1
            style={{
              fontSize: 'clamp(28px,4vw,40px)',
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.5px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Company Registration
          </h1>
        </div>
      </div>

      <div
        style={{
          maxWidth: 900,
          margin: '-32px auto 0',
          padding: '0 24px 80px',
        }}
      >
        <article
          style={{
            background: '#fff',
            borderRadius: 20,
            border: '1px solid var(--border)',
            padding: '24px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            style={{
              width: '100%',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: '#f8fafc',
            }}
          >
            <object
              data={`${CERT_PDF}#toolbar=0&navpanes=0&view=FitH`}
              type="application/pdf"
              aria-label="Vero360 Limited Company Registration Certificate"
              style={{
                display: 'block',
                width: '100%',
                height: 'min(85vh, 1100px)',
                border: 'none',
              }}
            >
              <iframe
                src={`${CERT_PDF}#toolbar=0&navpanes=0&view=FitH`}
                title="Vero360 Limited Company Registration Certificate"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'min(85vh, 1100px)',
                  border: 'none',
                }}
              />
            </object>
          </div>

          <p
            style={{
              marginTop: 16,
              marginBottom: 0,
              fontSize: 14,
              color: 'var(--text-3)',
              textAlign: 'center',
            }}
          >
            Can&apos;t see the certificate?{' '}
            <a
              href={CERT_PDF}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#EA580C', fontWeight: 600 }}
            >
              Open PDF
            </a>
          </p>
        </article>
      </div>
    </main>
  )
}
