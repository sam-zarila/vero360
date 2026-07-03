export default function CTASection() {
    return (
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, #9A3412 0%, #F97316 60%, #EA580C 100%)',
            borderRadius: 28, padding: '72px 56px',
            position: 'relative', overflow: 'hidden',
            textAlign: 'center',
          }}>
            {/* Decorative circles */}
            <div style={{
              position: 'absolute', top: -80, right: -80,
              width: 300, height: 300, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', filter: 'blur(40px)',
            }}/>
            <div style={{
              position: 'absolute', bottom: -60, left: -60,
              width: 200, height: 200, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', filter: 'blur(30px)',
            }}/>
            {/* Dot grid */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}/>
  
            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.12)', borderRadius: 100,
                padding: '6px 18px', marginBottom: 24, backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <span style={{ color: 'var(--success)', fontSize: 12 }}>●</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>Download the app</span>
              </div>
  
              <h2 style={{
                fontSize: 'clamp(32px,5vw,56px)', color: '#fff',
                fontWeight: 900, letterSpacing: '-1px',
                marginBottom: 20, fontFamily: 'var(--font-display)',
              }}>
                Your everyday life,{' '}
                <span style={{ color: '#fff' }}>one tap away</span>
              </h2>
              <p style={{
                fontSize: 18, color: 'rgba(255,255,255,0.7)',
                maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7,
              }}>
                Join thousands of Malawians using Vero360 to shop, ride, eat, stay, work, and connect — all from a single secure app.
              </p>
  
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/get-started" className="cta-primary">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Get started
                </a>
                <a href="/contact" className="cta-secondary">
                  List your business
                </a>
              </div>
  
              <p style={{ marginTop: 32, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                Free to download · Secure payments · Available on iOS & Android
              </p>
            </div>
          </div>
        </div>
        <style>{`
          .cta-primary {
            padding: 15px 32px; border-radius: 12px;
            background: #fff; color: var(--primary-dark);
            font-weight: 700; font-size: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            display: inline-flex; align-items: center; gap: 8;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.2);
          }
          .cta-secondary {
            padding: 15px 32px; border-radius: 12px;
            border: 1.5px solid rgba(255,255,255,0.35);
            color: #fff; font-weight: 600; font-size: 16px;
            background: rgba(255,255,255,0.08);
            backdrop-filter: blur(8px);
            transition: background 0.2s;
          }
          .cta-secondary:hover { background: rgba(255,255,255,0.15); }
        `}</style>
      </section>
    )
  }