import type { Metadata } from 'next'
import Navbar from '@/app/components/landing/navbar'
import Footer from '@/app/components/landing/Footer '
import { listPublicCarHireFiltered } from '@/lib/public-catalog'
import CarHireBrowseClient from './CarHireBrowseClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Car Hire · Vero360',
  description:
    'Rent a car across Malawi. Browse available vehicles, choose your pickup area and dates, then continue in the Vero360 app.',
  alternates: { canonical: 'https://vero360.app/car-hire' },
  openGraph: {
    title: 'Car Hire · Vero360',
    description:
      'Rent a car across Malawi. Browse available vehicles, choose your pickup area and dates, then continue in the Vero360 app.',
    url: 'https://vero360.app/car-hire',
    siteName: 'Vero360',
    type: 'website',
  },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim()
  return (value ?? '').trim()
}

function isoOrNull(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default async function CarHirePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const pickupArea = first(params.pickupArea)
  const startRaw = first(params.startAt)
  const endRaw = first(params.endAt)
  const startAt = isoOrNull(startRaw)
  const endAt = isoOrNull(endRaw)
  const hasRange = Boolean(startAt && endAt)

  const items = await listPublicCarHireFiltered({
    limit: 120,
    pickupArea: pickupArea || null,
    startAt: hasRange ? startAt : null,
    endAt: hasRange ? endAt : null,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <Navbar />
      <section
        style={{
          background: 'linear-gradient(135deg, #9A3412 0%, #F97316 48%, #EA580C 100%)',
          padding: '118px 24px 54px',
          color: '#fff',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            Vero360 Car Hire
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(30px, 5vw, 48px)',
              fontWeight: 900,
              letterSpacing: '-0.7px',
              fontFamily: 'var(--font-display)',
              maxWidth: 760,
            }}
          >
            The right car for the road ahead
          </h1>
          <p
            style={{
              margin: '14px 0 0',
              maxWidth: 640,
              fontSize: 16,
              lineHeight: 1.65,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            Browse published vehicles from Vero360 car-hire providers. Choose your pickup area
            and dates to see what is bookable, then finish the reservation in the app.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
            <span style={heroPill}>No sign-in to browse</span>
            <span style={heroPill}>Provider-managed availability</span>
            <span style={heroPill}>Pay securely in the app</span>
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
        <CarHireBrowseClient
          items={items}
          initialPickupArea={pickupArea}
          initialStartAt={startAt}
          initialEndAt={endAt}
        />
      </main>
      <Footer />
    </div>
  )
}

const heroPill = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.32)',
  background: 'rgba(255,255,255,0.12)',
  fontSize: 12,
  fontWeight: 700,
} as const
