const items = [
    { icon: '📱', value: '8+', label: 'Services in one app' },
    { icon: '👥', value: '5K+', label: 'Users goal' },
    { icon: '🏪', value: '20K+', label: 'Merchants goal' },
    { icon: '🚀', value: '1 Sep', label: 'App launch 2026' },
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
            <div key={item.value} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 24px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>{item.icon}</div>
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