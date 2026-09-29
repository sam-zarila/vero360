import { notFound } from 'next/navigation'
import { IconBadge } from '@/app/components/landing/icons'
import { getDashboardSection } from '@/lib/dashboard-sections'
import { DashboardBackLink } from '@/app/dashboard/DashboardChrome'

type Props = {
  params: Promise<{ section: string }>
}

export default async function DashboardSectionPage({ params }: Props) {
  const { section } = await params
  const data = getDashboardSection(section)
  if (!data) notFound()

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <IconBadge name={data.icon} size={28} bg={data.bg} color={data.color} />
          <h1
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: 900,
              letterSpacing: '-0.4px',
              margin: 0,
            }}
          >
            {data.title}
          </h1>
        </div>
        <p style={{ fontSize: 16, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 28 }}>
          {data.desc}
        </p>

        <div
          style={{
            borderRadius: 14,
            border: '1px dashed var(--border-2)',
            background: 'var(--surface)',
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 15,
          }}
        >
          Admin data for <strong style={{ color: 'var(--text)' }}>{data.title}</strong> will appear here.
        </div>
      </div>
    </div>
  )
}
