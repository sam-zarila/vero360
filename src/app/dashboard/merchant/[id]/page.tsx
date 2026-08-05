import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { loadMerchantStore } from '@/lib/merchant-store'
import { categoryLabel, resolveMarketplaceImage } from '@/lib/marketplace'
import { formatMwk } from '@/lib/vero-api'

type Props = {
  params: Promise<{ id: string }>
}

export default async function DashboardMerchantStorePage({ params }: Props) {
  const { id } = await params
  const store = await loadMerchantStore(id)
  if (!store) notFound()

  const { profile, products } = store
  const contact = profile.email || profile.phone

  return (
    <div>
      <Link
        href="/dashboard/merchant-reports"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-3)',
          marginBottom: 18,
        }}
      >
        ← Merchant reports
      </Link>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 22,
          padding: 20,
          borderRadius: 18,
          background: '#fff',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#F6F7FB',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          {profile.profileUrl ? (
            <Image
              src={profile.profileUrl}
              alt={profile.name}
              width={72}
              height={72}
              unoptimized
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            '🏪'
          )}
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
            }}
          >
            {profile.name}
          </h1>
          {contact ? (
            <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 14, fontWeight: 600 }}>
              {contact}
            </p>
          ) : null}
          {profile.openingHours ? (
            <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
              Hours: {profile.openingHours}
            </p>
          ) : null}
          {profile.description ? (
            <p style={{ margin: '10px 0 0', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.45 }}>
              {profile.description}
            </p>
          ) : null}
        </div>
      </div>

      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>
        Products ({products.length})
      </h2>

      {products.length === 0 ? (
        <p style={{ color: 'var(--text-3)' }}>No active products listed for this merchant.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14,
          }}
        >
          {products.map(product => {
            const image = resolveMarketplaceImage(product.image)
            return (
              <article
                key={product.key}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ aspectRatio: '1', background: '#F0F2F5', position: 'relative' }}>
                  {image ? (
                    <Image
                      src={image}
                      alt={product.name}
                      fill
                      unoptimized
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                        fontSize: 32,
                      }}
                    >
                      📦
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#C2410C',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    {categoryLabel(product.category)}
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>{product.name}</h3>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#15803D' }}>
                    {formatMwk(product.price)}
                  </p>
                  {product.location && product.location !== '—' ? (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                      {product.location}
                    </p>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
