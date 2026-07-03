import Image from 'next/image'

const team = [
  { name: 'Patson Chilikumtima', role: 'CTO' },
  { name: 'Samson Zalira', role: 'Full Stack Developer' },
  { name: 'Tenganawo Njikho', role: 'Marketer' },
  { name: 'Patrick Thala', role: 'Marketing Strategist' },
  { name: 'Gift Wahuta', role: 'Operations Manager', photo: '/team/gift-wahuta.jpg' },
]

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

export default function AboutUsSection() {
  return (
    <section id="about-us" style={{ padding: '100px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span style={{
            display: 'inline-block', padding: '6px 16px',
            background: 'var(--primary-light)', color: 'var(--primary)',
            borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 16,
          }}>About us</span>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.5px', marginBottom: 16 }}>
            Meet the Vero360 team
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-3)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
            We&apos;re building Malawi&apos;s all-in-one super app — connecting customers, merchants,
            and service providers through one secure platform.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
        }} className="team-grid">
          {team.map((member, i) => (
            <div key={member.name} className="team-card" style={{
              background: 'var(--surface)',
              borderRadius: 20, border: '1px solid var(--border)',
              padding: '32px 28px', textAlign: 'center',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: member.photo
                  ? 'transparent'
                  : i === 0
                    ? 'linear-gradient(135deg, #F97316, #EA580C)'
                    : 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 22, fontWeight: 800,
                color: i === 0 ? '#fff' : 'var(--primary-dark)',
                fontFamily: 'var(--font-display)',
                overflow: 'hidden',
              }}>
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt={member.name}
                    width={72}
                    height={72}
                    style={{ width: 72, height: 72, objectFit: 'cover' }}
                  />
                ) : (
                  initials(member.name)
                )}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, fontFamily: 'var(--font-display)' }}>
                {member.name}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
                {member.role}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .team-card { transition: box-shadow 0.3s, transform 0.3s; }
        .team-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
        @media (max-width: 900px) { .team-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px) { .team-grid { grid-template-columns: 1fr !important; max-width: 360px; margin: 0 auto; } }
      `}</style>
    </section>
  )
}
