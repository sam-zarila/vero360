import Link from 'next/link'
import { notFound } from 'next/navigation'
import { VeroIcon } from '@/app/components/landing/icons'
import { getDashboardSection } from '@/lib/dashboard-sections'

type Props = {
  params: Promise<{ section: string }>
}

export default async function DashboardSectionPage({ params }: Props) {
  const { section } = await params
  const data = getDashboardSection(section)
  if (!data) notFound()

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-3)',
          marginBottom: 20,
        }}
      >
        ← Back to dashboard
      </Link>

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
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: data.bg,
              color: data.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <VeroIcon name={data.icon} size={28} color={data.color} />
          </div>
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
