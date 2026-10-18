import type { Metadata } from 'next'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import ShareListingButton from '@/app/components/open-listing/ShareListingButton'
import { getPublicCarHireById } from '@/lib/public-catalog'
import {
  carHireAppHref,
  carHireStatusTone,
  carPriceLabel,
  carSubtitle,
  carTitle,
  fuelTypeLabel,
  resolveCarImage,
  transmissionLabel,
  type CarListing,
} from '@/lib/car-hire'
import { formatMwk, resolveVeroMediaUrl } from '@/lib/vero-api'
import CarHireBookingPanel from './CarHireBookingPanel'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const SITE = 'https://vero360.app'

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim()
  return (value ?? '').trim()
}

function absoluteMedia(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://')) return url.replace(/^http:\/\//i, 'https://')
  if (url.startsWith('https://')) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${SITE}${url}`
  return url
}

function listingDescription(car: CarListing): string {
  const base = [
    carSubtitle(car),
    car.dailyRate > 0 ? `${formatMwk(car.dailyRate)} per day` : null,
    car.description,
  ]
    .filter(Boolean)
    .join('. ')
  return base.length > 155 ? `${base.slice(0, 152).trim()}…` : base
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const car = await getPublicCarHireById(id)
  const title = car ? `${carTitle(car)} · Car hire · Vero360` : 'Car hire · Vero360'
  const description = car
    ? listingDescription(car)
    : 'This car listing is not available. Browse other car-hire vehicles on Vero360.'
  const canonical = `${SITE}/car-hire/${encodeURIComponent(id)}`
  const image = car ? absoluteMedia(resolveCarImage(car)) : null

  return {
    title,
    description,
    alternates: { canonical },
    robots: car ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Vero360',
      type: 'website',
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function CarHireDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const car = await getPublicCarHireById(id)
  const initialStartAt = first(query.startAt) || null
  const initialEndAt = first(query.endAt) || null

  if (!car) {
    return (
      <UnavailablePage
        id={id}
        title="This car is no longer listed"
        body="It may have been booked, unpublished, or removed by the provider. Continue in the app to see similar cars or browse the public catalogue."
      />
    )
  }

  const gallery = galleryOf(car)
  const hero = gallery[0] ?? null
  const available = car.isAvailable !== false && car.availableForDates !== false
  const statusTone = carHireStatusTone(available ? 'AVAILABLE' : 'UNAVAILABLE')
  const specs = [
    car.year ? String(car.year) : null,
    car.seats ? `${Math.round(car.seats)} seats` : null,
    car.transmission ? transmissionLabel(car.transmission) : null,
    car.fuelType ? fuelTypeLabel(car.fuelType) : null,
    car.bodyType ? car.bodyType.replace(/[_-]+/g, ' ').toLowerCase() : null,
    car.color,
  ].filter((value): value is string => Boolean(value))

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <header
        style={{
          background: 'linear-gradient(135deg, #9A3412 0%, #F97316 48%, #EA580C 100%)',
          padding: '24px 24px 40px',
          color: '#fff',
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/" aria-label="Vero360 home" style={{ display: 'inline-flex' }}>
            <Logo height={42} textColor="#fff" />
          </Link>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/car-hire" style={headerLink}>
              ← All cars
            </Link>
            <ShareListingButton
              light
              title={carTitle(car)}
              text={`Check out this car for hire on Vero360: ${carTitle(car)}`}
              url={`/car-hire/${car.id}`}
            />
          </div>
        </div>
      </header>

      <div
        className="car-detail-shell"
        style={{
          maxWidth: 1080,
          margin: '-24px auto 0',
          padding: '0 24px 80px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.55fr) minmax(300px, 0.9fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={cardStyle}>
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={`${carTitle(car)} — vehicle photo`}
                style={{
                  width: '100%',
                  aspectRatio: '16 / 10',
                  objectFit: 'cover',
                  display: 'block',
                  background: 'var(--surface-2)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
                  color: '#C2410C',
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                Photos are available in the app
              </div>
            )}

            {gallery.length > 1 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: 8,
                  padding: 10,
                }}
              >
                {gallery.slice(1, 6).map((src, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt={`${carTitle(car)} photo ${index + 2}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      objectFit: 'cover',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <section style={{ ...cardStyle, padding: 22, marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={eyebrowStyle}>Car hire · {car.pickupArea || 'Malawi'}</p>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 'clamp(26px, 4vw, 38px)',
                    fontWeight: 900,
                    letterSpacing: '-0.6px',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {carTitle(car)}
                </h1>
                <p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--text-3)' }}>
                  {carSubtitle(car) || 'Vehicle details confirmed in the app'}
                </p>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 11px',
                  borderRadius: 999,
                  background: statusTone.bg,
                  color: statusTone.color,
                  border: `1px solid ${statusTone.border}`,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {available ? 'Available' : 'Unavailable'}
              </span>
            </div>

            {specs.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                {specs.map(spec => (
                  <span key={spec} style={chipStyle}>
                    {spec}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 22 }}>
              <h2 style={sectionTitle}>About this car</h2>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
                {car.description || 'The provider has not added a description yet. Ask for full vehicle details in the app.'}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
                marginTop: 22,
              }}
            >
              <Fact label="Daily rate" value={carPriceLabel(car)} />
              <Fact label="Pickup area" value={car.pickupArea || 'Confirmed in app'} />
              <Fact
                label="Minimum rental"
                value={`${car.minRentalDays} ${car.minRentalDays === 1 ? 'day' : 'days'}`}
              />
              <Fact
                label="Deposit"
                value={car.depositAmount > 0 ? formatMwk(car.depositAmount) : 'No deposit listed'}
              />
            </div>
          </section>

          <section style={{ ...cardStyle, padding: 22, marginTop: 18 }}>
            <h2 style={sectionTitle}>Trust &amp; compliance</h2>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
              Vero360 reviews car-hire provider applications, but this public page does not expose
              private compliance documents, registration plates, or owner details. Always confirm
              the vehicle&apos;s condition, registration, insurance, and rental terms at pickup
              before you drive.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
              Keep payments and communication inside the Vero360 app. Do not send money or share
              account credentials outside it.
            </p>
            {car.rating > 0 ? (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                Rating: {car.rating.toFixed(1)} / 5{car.reviews > 0 ? ` · ${car.reviews} reviews` : ''}
              </p>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                No public rental reviews yet.
              </p>
            )}
          </section>
        </div>

        <aside style={{ minWidth: 0, position: 'sticky', top: 18 }}>
          <CarHireBookingPanel
            carId={car.id}
            dailyRate={car.dailyRate}
            currency={car.currency}
            minRentalDays={car.minRentalDays}
            maxRentalDays={car.maxRentalDays}
            depositAmount={car.depositAmount}
            available={available}
            pickupArea={car.pickupArea}
            initialStartAt={initialStartAt}
            initialEndAt={initialEndAt}
          />

          <div style={{ ...cardStyle, padding: 18, marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--text-2)' }}>
              What happens next
            </p>
            <ol
              style={{
                margin: '10px 0 0',
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--text-3)',
              }}
            >
              <li>Choose your pickup and return times.</li>
              <li>Continue in the Vero360 app.</li>
              <li>The app confirms live availability and the final quote.</li>
              <li>The provider confirms the rental and payment is handled securely.</li>
            </ol>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
              Availability and pricing are confirmed by the backend when you continue in the app.
            </p>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .car-detail-shell {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .car-detail-shell > aside {
            position: static !important;
          }
        }
      `}</style>
    </main>
  )
}

function galleryOf(car: CarListing): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [resolveCarImage(car), ...car.images.map(resolveVeroMediaUrl)]) {
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }
  return out
}

function UnavailablePage({ id, title, body }: { id: string; title: string; body: string }) {
  const appHref = carHireAppHref(id)
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 42%, #FFF7ED 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          background: '#fff',
          borderRadius: 24,
          padding: '34px 28px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <Link href="/" style={{ display: 'inline-flex', marginBottom: 18 }}>
          <Logo height={56} />
        </Link>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900, letterSpacing: '-0.4px' }}>
          {title}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-3)' }}>
          {body}
        </p>
        <a href={appHref} style={{ ...primaryButtonStyle, marginTop: 20 }}>
          Continue in the app
        </a>
        <Link href="/car-hire" style={{ ...ghostButtonStyle, marginTop: 10 }}>
          Browse other cars
        </Link>
        <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
          Don&apos;t have the app?{' '}
          <a href="https://play.google.com/store/apps/details?id=com.vero265.app" style={inlineLink}>
            Google Play
          </a>{' '}
          ·{' '}
          <a href="https://apps.apple.com/search?term=Vero360" style={inlineLink}>
            App Store
          </a>
        </p>
      </div>
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        borderRadius: 12,
        padding: '11px 13px',
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}

const cardStyle = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
} as const

const headerLink = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.34)',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
} as const

const eyebrowStyle = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: '#C2410C',
} as const

const sectionTitle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: '-0.2px',
} as const

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 11px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  fontSize: 12,
  fontWeight: 700,
} as const

const primaryButtonStyle = {
  display: 'block',
  width: '100%',
  padding: '14px 18px',
  borderRadius: 13,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  textAlign: 'center',
  textDecoration: 'none',
} as const

const ghostButtonStyle = {
  display: 'block',
  width: '100%',
  padding: '13px 18px',
  borderRadius: 13,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  fontSize: 14,
  fontWeight: 800,
  textAlign: 'center',
  textDecoration: 'none',
} as const

const inlineLink = {
  color: '#EA580C',
  fontWeight: 700,
  textDecoration: 'none',
} as const