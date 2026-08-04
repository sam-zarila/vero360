'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCourierPendingBadge, useNewUsersBadge, useOrdersPendingBadge } from './AdminAlertsProvider'
import { usePanelSession } from './PanelSessionProvider'
import {
  isHelpCenterSession,
  subscribeToSessions,
  type VeroChatSessionView,
} from '@/lib/verochat'

const cards = [
  {
    id: 'vero-ride',
    title: 'Vero Ride',
    desc: 'Trips, drivers, and ride activity',
    icon: '🚗',
    color: '#F97316',
    bg: '#FFF7ED',
  },
  {
    id: 'vero-courier',
    title: 'Vero Courier',
    desc: 'Deliveries, parcels, and couriers',
    icon: '🚚',
    color: '#EA580C',
    bg: '#FFEDD5',
  },
  {
    id: 'food',
    title: 'Food',
    desc: 'Orders, restaurants, and menus',
    icon: '🍔',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
  {
    id: 'jobs',
    title: 'Jobs',
    desc: 'Post, edit, and manage job listings',
    icon: '💼',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    id: 'stay',
    title: 'Stay',
    desc: 'Accommodation bookings and hosts',
    icon: '🏨',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    id: 'promotion',
    title: 'Promotion',
    desc: 'Campaigns, ads, and offers',
    icon: '📣',
    color: '#DB2777',
    bg: '#FDF2F8',
  },
  {
    id: 'latest-arrivals',
    title: 'Latest arrivals',
    desc: 'New products and featured items',
    icon: '✨',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    desc: 'Listings, merchants, and sales',
    icon: '🛒',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    id: 'orders',
    title: 'Orders',
    desc: 'Marketplace orders and fulfillment',
    icon: '📦',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  {
    id: 'refunds',
    title: 'Refunds',
    desc: 'Pending and completed refund requests',
    icon: '↩️',
    color: '#BE123C',
    bg: '#FFF1F2',
  },
  {
    id: 'users',
    title: 'Users',
    desc: 'Customers, merchants, and accounts',
    icon: '👥',
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    id: 'admins',
    title: 'Admins',
    desc: 'Super admins and panel admins',
    icon: '🛡️',
    color: '#6D28D9',
    bg: '#F5F3FF',
    superAdminOnly: true,
  },
  {
    id: 'finance',
    title: 'Finance',
    desc: 'Wallets, escrow release, and payouts',
    icon: '💰',
    color: '#15803D',
    bg: '#F0FDF4',
    superAdminOnly: true,
  },
  {
    id: 'verochat',
    title: 'Help Center',
    desc: 'Live chats from Vero360 Help Center',
    icon: '🎧',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
]

function getHelpCenterUnread(sessions: VeroChatSessionView[]) {
  return sessions
    .filter(isHelpCenterSession)
    .reduce((sum, s) => sum + (s.unreadForAgent || 0), 0)
}

export default function DashboardCards() {
  const [unread, setUnread] = useState(0)
  const courierPending = useCourierPendingBadge()
  const ordersPending = useOrdersPendingBadge()
  const newUsers = useNewUsersBadge()
  const { isSuperAdmin } = usePanelSession()

  useEffect(() => {
    return subscribeToSessions(sessions => {
      setUnread(getHelpCenterUnread(sessions))
    })
  }, [])

  return (
    <div
      className="dashboard-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 18,
      }}
    >
      {cards
        .filter(card => !('superAdminOnly' in card && card.superAdminOnly) || isSuperAdmin)
        .map(card => {
        const isHelp = card.id === 'verochat'
        const isCourier = card.id === 'vero-courier'
        const isOrders = card.id === 'orders'
        const isUsers = card.id === 'users'
        const badgeCount = isHelp
          ? unread
          : isCourier
            ? courierPending
            : isOrders
              ? ordersPending
              : isUsers
                ? newUsers
                : 0
        const showBadge = badgeCount > 0
        const alertLabel = isHelp
          ? `${badgeCount} unread Help Center messages`
          : isCourier
            ? `${badgeCount} pending Vero Courier order${badgeCount === 1 ? '' : 's'}`
            : isOrders
              ? `${badgeCount} pending marketplace order${badgeCount === 1 ? '' : 's'}`
              : `${badgeCount} new user${badgeCount === 1 ? '' : 's'}`
        const alertDesc = isHelp
          ? `${badgeCount} new message${badgeCount === 1 ? '' : 's'} waiting`
          : isCourier
            ? `${badgeCount} new order${badgeCount === 1 ? '' : 's'} waiting`
            : isOrders
              ? `${badgeCount} order${badgeCount === 1 ? '' : 's'} needing review`
              : `${badgeCount} new registration${badgeCount === 1 ? '' : 's'}`
        const alertCta = isHelp
          ? 'Reply now →'
          : isCourier
            ? 'Review now →'
            : isOrders
              ? 'Open orders →'
              : 'View users →'

        return (
          <Link
            key={card.id}
            href={`/dashboard/${card.id}`}
            className={`dashboard-card${showBadge ? ' dashboard-card-alert' : ''}`}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: 22,
              borderRadius: 18,
              background: '#fff',
              border: showBadge ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              boxShadow: showBadge ? '0 8px 28px rgba(249,115,22,0.18)' : 'var(--shadow-sm)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
              minHeight: 168,
            }}
          >
            {showBadge && (
              <span
                aria-label={alertLabel}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  minWidth: 24,
                  height: 24,
                  padding: '0 7px',
                  borderRadius: 100,
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 3px rgba(249,115,22,0.2)',
                }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}

            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: card.bg,
                color: card.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                position: 'relative',
              }}
            >
              {card.icon}
              {showBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#EF4444',
                    border: '2px solid #fff',
                  }}
                />
              )}
            </div>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginBottom: 6,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {card.title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
                {showBadge ? alertDesc : card.desc}
              </p>
            </div>
            <span
              style={{
                marginTop: 'auto',
                fontSize: 13,
                fontWeight: 600,
                color: card.color,
              }}
            >
              {showBadge ? alertCta : 'Open →'}
            </span>
          </Link>
        )
      })}

      <style>{`
        .dashboard-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
          border-color: var(--border-2);
        }
        .dashboard-card-alert {
          animation: helpPulse 1.8s ease-in-out infinite;
        }
        @keyframes helpPulse {
          0%, 100% { box-shadow: 0 8px 28px rgba(249,115,22,0.18); }
          50% { box-shadow: 0 10px 36px rgba(249,115,22,0.32); }
        }
      `}</style>
    </div>
  )
}
