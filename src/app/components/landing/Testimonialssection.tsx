const reviews = [
    {
      name: 'James Banda',
      role: 'Regular rider · Lilongwe',
      avatar: 'JB',
      avatarColor: '#F97316',
      stars: 5,
      text: 'Vero360 is so much better than waiting at the roadside. I book, the driver arrives in 3 minutes, and the price is always clear upfront. I use it every morning for work.',
    },
    {
      name: 'Drip Closet',
      role: 'Business owner · Lilongwe',
      avatar: 'DC',
      avatarColor: '#D97706',
      stars: 5,
      text: 'I have vero merchant account, super easy to use and very convenient,i post,edit,manage my listings and accept payments.',
    },
    {
      name: 'Peter Chanda',
      role: 'Driver · Zomba',
      avatar: 'PC',
      avatarColor: '#22C55E',
      stars: 5,
      text: 'Before Vero360 I waited at the rank for hours. Now I get 8-10 trips a day directly in the app. The earnings are consistent and the platform is very easy to use.',
    },
  ]
  
  const StarIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
  
  export default function TestimonialsSection() {
    return (
      <section style={{ padding: '100px 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{
              display: 'inline-block', padding: '6px 16px',
              background: 'var(--primary-light)', color: 'var(--primary-dark)',
              borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>Reviews</span>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.5px', marginBottom: 16 }}>
              What people say
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-3)' }}>Real stories from Vero360 riders and drivers.</p>
          </div>
  
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }} className="reviews-grid">
            {reviews.map((r, i) => (
              <div key={i} className="review-card" style={{
                background: '#fff', borderRadius: 20,
                border: '1px solid var(--border)',
                padding: '32px 28px',
              }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
                  {Array(r.stars).fill(null).map((_, j) => <StarIcon key={j}/>)}
                </div>
                {/* Quote mark */}
                <div style={{ fontSize: 56, lineHeight: 0.6, color: 'var(--primary-light)', fontFamily: 'Georgia', marginBottom: 16 }}>&ldquo;</div>
                <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.75, marginBottom: 28 }}>{r.text}</p>
  
                {/* Author */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: r.avatarColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)',
                    flexShrink: 0,
                  }}>{r.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          .review-card { transition: box-shadow 0.3s, transform 0.3s; }
          .review-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
          @media (max-width: 900px) { .reviews-grid { grid-template-columns: 1fr !important; max-width: 480px; margin: 0 auto; } }
        `}</style>
      </section>
    )
  }