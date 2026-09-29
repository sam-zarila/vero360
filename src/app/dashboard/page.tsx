import { IconBadge } from '@/app/components/landing/icons'
import DashboardCards from './DashboardCards'

export default function DashboardPage() {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          marginBottom: 28,
        }}
      >
        <IconBadge name="grid" size={28} bg="#EFF6FF" color="#2563EB" />
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(26px, 3vw, 34px)',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-3)', maxWidth: 560, margin: '8px 0 0' }}>
            Overview of Vero360 services. Open a card to manage that area.
          </p>
        </div>
      </div>

      <DashboardCards />
    </div>
  )
}
