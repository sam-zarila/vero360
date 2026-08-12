import { IconBadge } from './icons'

const items = [
  { icon: 'layers' as const, value: '8+', label: 'Services in one app' },
  { icon: 'users' as const, value: '5K+', label: 'Community target' },
  { icon: 'shop' as const, value: '20K+', label: 'Merchant partners' },
  { icon: 'calendar' as const, value: '1 Sep', label: 'App launch 2026' },
]

export default function TrustBar() {
  return (
    <section style={{
      padding: '48px 24px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 24,
      }} className="trust-grid">
        {items.map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '20px 24px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            <IconBadge name={item.icon} size={20} />
            <div>
              <div style={{
                fontSize: 26, fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: 'var(--primary)', lineHeight: 1,
              }}>{item.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 900px) { .trust-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 500px) { .trust-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  )
}
