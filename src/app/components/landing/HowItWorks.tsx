const steps = [
    {
      num: '01',
      icon: (
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#F97316"/>
        </svg>
      ),
      title: 'Browse & search',
      desc: 'Open Vero360 and find what you need — rides, food, products, jobs, or accommodation.',
      color: '#FFF7ED',
    },
    {
      num: '02',
      icon: (
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2"/>
          <path d="M12 6v6l4 2" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Book or order',
      desc: 'Choose a service, confirm details, and get matched with a driver, merchant, or provider.',
      color: '#FEF3C7',
    },
    {
      num: '03',
      icon: (
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="7" rx="2" stroke="#F97316" strokeWidth="2"/>
          <path d="M5 11V8a7 7 0 0114 0v3" stroke="#F97316" strokeWidth="2"/>
          <circle cx="9" cy="15" r="1" fill="#F97316"/>
          <circle cx="15" cy="15" r="1" fill="#F97316"/>
        </svg>
      ),
      title: 'Track in real-time',
      desc: 'Follow your ride, delivery, or booking status live. Chat securely with providers.',
      color: '#ECFDF5',
    },
    {
      num: '04',
      icon: (
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      ),
      title: 'Pay securely',
      desc: 'Pay via mobile money. Funds are held securely until both parties are satisfied.',
      color: '#FFF1F2',
    },
  ]
  
  export default function HowItWorks() {
    return (
      <section id="how-it-works" style={{ padding: '100px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
  
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{
              display: 'inline-block', padding: '6px 16px',
              background: 'var(--primary-light)', color: 'var(--primary)',
              borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>How it works</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-0.5px', marginBottom: 16 }}>
              Get started in 4 simple steps
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-3)', maxWidth: 480, margin: '0 auto' }}>
              Vero360 simplifies everyday life — shop, ride, eat, stay, and connect from one app.
            </p>
          </div>
  
          {/* Steps grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24, position: 'relative',
          }} className="steps-grid">
  
            {/* Connector line (desktop) */}
            <div style={{
              position: 'absolute', top: 48, left: '12.5%', right: '12.5%', height: 2,
              background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
              zIndex: 0,
            }} className="steps-connector"/>
  
            {steps.map((step, i) => (
              <div key={i} className="step-card" style={{
                background: '#fff',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '32px 24px',
                position: 'relative',
                zIndex: 1,
              }}>
                {/* Step number */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: step.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {step.icon}
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 900,
                    fontSize: 40, color: 'var(--border-2)',
                    lineHeight: 1,
                  }}>{step.num}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
  
        <style>{`
          .step-card { transition: box-shadow 0.3s, transform 0.3s; }
          .step-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
          @media (max-width: 900px) { .steps-grid { grid-template-columns: repeat(2,1fr) !important; } .steps-connector { display: none !important; } }
          @media (max-width: 540px) { .steps-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>
    )
  }