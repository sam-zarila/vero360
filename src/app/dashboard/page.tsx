import DashboardCards from './DashboardCards'

export default function DashboardPage() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 'clamp(26px, 3vw, 34px)',
            fontWeight: 900,
            letterSpacing: '-0.5px',
            marginBottom: 8,
          }}
        >
          Dashboard
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-3)', maxWidth: 560 }}>
          Overview of Vero360 services. Open a card to manage that area.
        </p>
      </div>

      <DashboardCards />
    </div>
  )
}
