'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import type { SellBanner } from '@/lib/sell-banners'
import { resolveSellBannerImage } from '@/lib/sell-banners'

export type SellBannerSlide = Pick<
  SellBanner,
  'id' | 'title' | 'body' | 'ctaLabel' | 'imageUrl'
>

type Props = {
  banners: SellBannerSlide[]
}

/** Sliding sell banners — same source as the app (`sell_banners` from admin). */
export default function SellBannerClient({ banners }: Props) {
  const slides = banners.length > 0 ? banners : []
  const [index, setIndex] = useState(0)
  const count = slides.length

  const go = useCallback(
    (next: number) => {
      if (count <= 0) return
      setIndex(((next % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (count <= 1) return
    const timer = window.setInterval(() => {
      setIndex(i => (i + 1) % count)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [count])

  // Prefetch upcoming slide images so carousel feels as snappy as the app.
  useEffect(() => {
    if (typeof window === 'undefined' || count === 0) return
    const warm = (i: number) => {
      const url = resolveSellBannerImage(slides[i]?.imageUrl)
      if (!url) return
      const img = new window.Image()
      img.src = url
    }
    warm(index)
    if (count > 1) warm((index + 1) % count)
  }, [count, index, slides])

  if (count === 0) return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          boxShadow: '0 12px 36px rgba(154, 52, 18, 0.22)',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: `${count * 100}%`,
            transform: `translateX(-${(index * 100) / count}%)`,
            transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {slides.map(slide => {
            const imageSrc = resolveSellBannerImage(slide.imageUrl)
            return (
              <div
                key={slide.id}
                style={{
                  width: `${100 / count}%`,
                  flexShrink: 0,
                  position: 'relative',
                  minHeight: 200,
                  background:
                    'linear-gradient(135deg, #9A3412 0%, #EA580C 55%, #F97316 100%)',
                  color: '#fff',
                }}
              >
                {imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageSrc}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}

                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: imageSrc
                      ? 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.42) 48%, rgba(0,0,0,0.22) 100%)'
                      : 'transparent',
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 24,
                    padding: 'clamp(28px, 4vw, 40px) clamp(24px, 4vw, 40px)',
                    minHeight: 200,
                  }}
                >
                  <div style={{ maxWidth: 720, flex: '1 1 280px' }}>
                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      Sell on Vero360
                    </p>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 'clamp(24px, 3.5vw, 34px)',
                        fontWeight: 900,
                        letterSpacing: '-0.4px',
                        fontFamily: 'var(--font-display)',
                        lineHeight: 1.15,
                      }}
                    >
                      {slide.title}
                    </h2>
                    {slide.body ? (
                      <p
                        style={{
                          margin: '12px 0 0',
                          fontSize: 16,
                          lineHeight: 1.6,
                          color: 'rgba(255,255,255,0.88)',
                          maxWidth: 560,
                        }}
                      >
                        {slide.body}
                      </p>
                    ) : null}
                  </div>

                  <div style={{ flex: '0 0 auto' }}>
                    <Link
                      href="/get-started?role=merchant"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '14px 28px',
                        borderRadius: 12,
                        background: '#fff',
                        color: '#9A3412',
                        fontWeight: 800,
                        fontSize: 16,
                        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                        textDecoration: 'none',
                      }}
                    >
                      {slide.ctaLabel || 'Sell now'}
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <path
                          d="M5 12h14M12 5l7 7-7 7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous sell banner"
              onClick={() => go(index - 1)}
              style={navBtnStyle('left')}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next sell banner"
              onClick={() => go(index + 1)}
              style={navBtnStyle('right')}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 12,
          }}
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show sell banner ${i + 1}`}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 99,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: i === index ? '#EA580C' : '#FDBA74',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function navBtnStyle(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 10,
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.35)',
    color: '#fff',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}
