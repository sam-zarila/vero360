'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Logo from '@/app/components/landing/Logo'
import StoreDownloadLinks from '@/app/components/landing/StoreDownloadLinks'

const roles = [
  {
    id: 'customer',
    emoji: '👤',
    title: 'Customer',
    desc: 'Shop, ride, order food, book stays, and access every Vero360 service as a user.',
    cta: 'Watch tutorial video',
    videoTitle: 'Getting started as a customer',
    videoDesc: 'Learn how to browse services, place orders, and manage your account on Vero360.',
  },
  {
    id: 'merchant',
    emoji: '🏪',
    title: 'Merchant',
    desc: 'List products, manage orders, and grow your business on the Vero360 marketplace.',
    cta: 'Watch tutorial video',
    videoTitle: 'Getting started as a merchant',
    videoDesc: 'See how to set up your store, list products, and fulfil orders on Vero360.',
  },
  {
    id: 'driver',
    emoji: '🧑',
    title: 'Driver',
    desc: 'Join Vero Ride and courier networks. Earn on your schedule with weekly payouts.',
    cta: 'Watch tutorial video',
    videoTitle: 'Getting started as a driver',
    videoDesc: 'Learn how to accept rides, manage deliveries, and get paid on Vero360.',
  },
] as const

type RoleId = (typeof roles)[number]['id']

function isRoleId(value: string | null): value is RoleId {
  return roles.some(r => r.id === value)
}

export default function GetStartedClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const videoRef = useRef<HTMLDivElement>(null)
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null)

  useEffect(() => {
    const role = searchParams.get('role')
    if (isRoleId(role)) {
      setSelectedRole(role)
      requestAnimationFrame(() => {
        videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [searchParams])

  const selectRole = (roleId: RoleId) => {
    setSelectedRole(roleId)
    router.replace(`/get-started?role=${roleId}`, { scroll: false })
    requestAnimationFrame(() => {
      videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const activeRole = roles.find(r => r.id === selectedRole)

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div style={{
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
        padding: '48px 24px 80px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <Logo height={44} textColor="#fff" />
          </div>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500,
            marginBottom: 32,
          }}>
            ← Back to home
          </Link>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.5px', marginBottom: 12, fontFamily: 'var(--font-display)',
          }}>
            Get started with Vero360
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, maxWidth: 520 }}>
            Choose how you want to use the platform and watch the tutorial video to get started.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '-48px auto 0', padding: '0 24px 80px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20,
        }} className="roles-grid">
          {roles.map(role => {
            const isActive = selectedRole === role.id
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role.id)}
                className={`role-card${isActive ? ' role-card-active' : ''}`}
                style={{
                  background: '#fff', borderRadius: 20,
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                  padding: '32px 28px',
                  display: 'flex', flexDirection: 'column', textAlign: 'left',
                  transition: 'box-shadow 0.25s, transform 0.25s, border-color 0.25s',
                  boxShadow: isActive ? 'var(--shadow-lg)' : 'none',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: isActive ? 'var(--primary)' : 'var(--primary-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, marginBottom: 20,
                }}>{role.emoji}</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, fontFamily: 'var(--font-display)' }}>
                  {role.title}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, flex: 1, marginBottom: 24 }}>
                  {role.desc}
                </p>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: 'var(--primary)', fontWeight: 700, fontSize: 15,
                }}>
                  {role.cta}
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
            )
          })}
        </div>

        {activeRole && (
          <div
            ref={videoRef}
            className="role-video-panel"
            style={{
              marginTop: 32,
              background: '#fff',
              borderRadius: 20,
              border: '2px solid var(--primary)',
              padding: '36px 32px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <span style={{
              display: 'inline-block', padding: '4px 12px', marginBottom: 12,
              background: 'var(--primary-light)', color: 'var(--primary-dark)',
              borderRadius: 100, fontSize: 12, fontWeight: 700,
            }}>
              {activeRole.title} tutorial
            </span>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, fontFamily: 'var(--font-display)' }}>
              {activeRole.videoTitle}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 24 }}>
              {activeRole.videoDesc}
            </p>
            <div style={{
              aspectRatio: '16 / 9',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" fill="#fff" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500 }}>
                Tutorial video for {activeRole.title.toLowerCase()}s — coming soon
              </p>
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
                Open the Vero360 app and create your {activeRole.title.toLowerCase()} account.
              </p>
              <StoreDownloadLinks />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .role-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-4px);
          border-color: var(--primary-light);
        }
        .role-card-active {
          transform: translateY(-4px);
        }
        @media (max-width: 768px) {
          .roles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
