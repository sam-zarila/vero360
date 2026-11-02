import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const points = [
  ['Role of Vero360', 'Facilitator only. No vehicles are owned, insured or operated by Vero360.'],
  ['Who can list', 'Verified Vehicle Partners with a roadworthy, insured vehicle and proof of ownership or authority.'],
  ['Who can book', 'Verified Renters. Self-drive requires a valid driving licence for the class of vehicle.'],
  ['Pricing', 'Set by the Vehicle Partner. Vero360 commission is added on top, never deducted.'],
  ['Payment', 'In-app only, through PawaPay. Payments outside the App are not protected.'],
  ['Security deposit', 'Held by Vero360 and returned after the trip unless a substantiated claim is lodged.'],
  ['Handover and return', 'Photo Condition Report on both occasions, and GPS-tied trip start.'],
  ['Accidents', 'Report at once to the police where required, to the Vehicle Partner and to Vero360 in the App.'],
  ['Disputes', 'Reviewed by Vero360 on the evidence recorded in the App.'],
]

export default function CarHirePolicyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Logo height={40} />
        <p style={{ marginTop: 24 }}>
          <Link href="/legal" style={{ color: '#EA580C', fontWeight: 600 }}>
            ← Legal documents
          </Link>
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.4px', margin: '20px 0 8px' }}>
          Car Hire Service Policy
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          Version 1.0 · Vero360 Limited · These are the rules Vero uses for every car hire on the App.
        </p>
        <div style={{ marginTop: 28, display: 'grid', gap: 12 }}>
          {points.map(([topic, summary]) => (
            <article
              key={topic}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: '#fff',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{topic}</h2>
              <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
                {summary}
              </p>
            </article>
          ))}
        </div>
        <p style={{ marginTop: 24 }}>
          <a
            href="/legal/Vero360_Car_Hire_Service_Policy.pdf"
            style={{ color: '#EA580C', fontWeight: 700 }}
          >
            Open the full PDF →
          </a>
        </p>
      </div>
    </main>
  )
}
