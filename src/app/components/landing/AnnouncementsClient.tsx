'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  formatAnnouncementPostedAt,
  resolveAnnouncementImage,
  type Announcement,
} from '@/lib/announcements'

type Props = {
  items: Announcement[]
}

export default function AnnouncementsClient({ items }: Props) {
  const [selected, setSelected] = useState<Announcement | null>(null)
  const [showFullImage, setShowFullImage] = useState(false)
  const [mounted, setMounted] = useState(false)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showFullImage) setShowFullImage(false)
      else setSelected(null)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [selected, showFullImage])

  const open = (item: Announcement) => {
    setShowFullImage(false)
    setSelected(item)
  }

  const close = () => {
    setShowFullImage(false)
    setSelected(null)
  }

  const selectedImage = selected ? resolveAnnouncementImage(selected.imageUrl) : null

  const detailModal =
    selected && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(17, 24, 39, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 'min(720px, 100%)',
                maxHeight: 'min(92vh, 920px)',
                overflow: 'auto',
                background: '#fff',
                borderRadius: 20,
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky',
                  top: 0,
                  background: '#fff',
                  zIndex: 1,
                }}
              >
                <time
                  dateTime={selected.postedAt || undefined}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}
                >
                  {formatAnnouncementPostedAt(selected.postedAt)}
                </time>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close announcement"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: '#fff',
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: 'pointer',
                    color: 'var(--text-2)',
                  }}
                >
                  ×
                </button>
              </div>

              {selectedImage ? (
                <button
                  type="button"
                  onClick={() => setShowFullImage(true)}
                  aria-label="View full image"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    cursor: 'zoom-in',
                    position: 'relative',
                    aspectRatio: '16 / 10',
                    background: '#111827',
                  }}
                >
                  <Image
                    src={selectedImage}
                    alt={selected.title}
                    fill
                    unoptimized
                    style={{ objectFit: 'contain' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 12,
                      padding: '6px 10px',
                      borderRadius: 100,
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    View image
                  </span>
                </button>
              ) : null}

              <div style={{ padding: '22px 22px 28px' }}>
                <h3
                  id={titleId}
                  style={{
                    margin: '0 0 12px',
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: '-0.4px',
                    fontFamily: 'var(--font-display)',
                    lineHeight: 1.2,
                  }}
                >
                  {selected.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: 'var(--text-2)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selected.description}
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  const imageModal =
    selected && showFullImage && selectedImage && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Announcement image"
            onClick={() => setShowFullImage(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10001,
              background: 'rgba(0, 0, 0, 0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              cursor: 'zoom-out',
            }}
          >
            <button
              type="button"
              onClick={() => setShowFullImage(false)}
              aria-label="Close image"
              style={{
                position: 'fixed',
                top: 16,
                right: 16,
                width: 44,
                height: 44,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 24,
                cursor: 'pointer',
                zIndex: 1,
              }}
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt={selected.title}
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: 'min(96vw, 1200px)',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                cursor: 'default',
              }}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div
        className="announce-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: items.length === 1 ? 'minmax(0, 560px)' : 'repeat(3, 1fr)',
          gap: 24,
          justifyContent: 'center',
        }}
      >
        {items.map(item => {
          const img = resolveAnnouncementImage(item.imageUrl)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item)}
              className="announce-card"
              aria-label={`Open announcement: ${item.title}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                margin: 0,
                padding: 0,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                background: 'var(--surface)',
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
                appearance: 'none',
                WebkitAppearance: 'none',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 10',
                  background: 'linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)',
                  pointerEvents: 'none',
                }}
              >
                {img ? (
                  <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#9A3412',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Vero360
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: '20px 20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                  pointerEvents: 'none',
                }}
              >
                <time
                  dateTime={item.postedAt || undefined}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  {formatAnnouncementPostedAt(item.postedAt)}
                </time>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: '-0.3px',
                    lineHeight: 1.25,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: 'var(--text-2)',
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.description}
                </p>
                <span
                  style={{
                    marginTop: 'auto',
                    paddingTop: 4,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--primary)',
                  }}
                >
                  Read more →
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {detailModal}
      {imageModal}

      <style>{`
        .announce-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md, 0 12px 28px rgba(0,0,0,0.1));
          border-color: var(--primary-light, #FDBA74);
        }
        .announce-card:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 3px;
        }
        @media (max-width: 960px) {
          .announce-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .announce-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
