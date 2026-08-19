import Image from 'next/image'

const team = [
  { name: 'Patson Chilikumtima', role: 'CTO', photo: '/team/patson-cto.jpeg' },
  { name: 'Samson Zalira', role: 'Full Stack Developer', photo: '/team/samson-zalira.jpeg' },
  { name: 'Tenganawo Njikho', role: 'Marketer and social media manager', photo: '/team/tenganawo-njikho.jpeg' },
  { name: 'Patrick Thala', role: 'Technical Support Manager', photo: '/team/patrick-thala.jpeg' },
  { name: 'Gift Wahuta', role: 'Operations Manager', photo: '/team/gift-wahuta.jpg' },
]

const missionVisionValues = [
  {
    title: 'Our Mission',
    body: 'To simplify everyday life by providing a reliable, secure, and unified digital platform for services and commerce.',
  },
  {
    title: 'Our Vision',
    body: "To become Malawi's leading super app for digital services, empowering businesses and improving customer experiences.",
  },
  {
    title: 'Our Values',
    body: 'Innovation · Reliability · Security · Accessibility · Customer-Centricity',
  },
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
          }}>About Vero360</span>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.5px', marginBottom: 16 }}>
            Who we are
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-3)', maxWidth: 680, margin: '0 auto', lineHeight: 1.8 }}>
            Vero360 started in 2025 when a group of university students saw everyday problems around them 
            unreliable transport, hard to find local businesses, and fragmented services and decided to build
            something better. What began as a student project to solve real problems in our communities has
            grown into Malawi&apos;s  all-in-one  super app, connecting customers, merchants, and service providers
            through one secure platform.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          marginBottom: 80,
        }} className="mvv-grid">
          {missionVisionValues.map(item => (
            <div key={item.title} style={{
              background: 'var(--surface)',
              borderRadius: 20, border: '1px solid var(--border)',
              padding: '32px 28px',
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700, color: 'var(--primary)',
                marginBottom: 12, fontFamily: 'var(--font-display)',
              }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Meet the team
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-3)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            The people building Vero360 every day.
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
                    unoptimized
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
        @media (max-width: 900px) {
          .team-grid, .mvv-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .team-grid, .mvv-grid { grid-template-columns: 1fr !important; max-width: 360px; margin-left: auto; margin-right: auto; }
        }
      `}</style>
    </section>
  )
}
