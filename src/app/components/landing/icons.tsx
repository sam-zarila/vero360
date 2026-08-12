import type { CSSProperties, ReactNode } from 'react'

export type VeroIconName =
  | 'car'
  | 'plane'
  | 'truck'
  | 'bike'
  | 'forex'
  | 'food'
  | 'briefcase'
  | 'bed'
  | 'home'
  | 'store'
  | 'cart'
  | 'chat'
  | 'grid'
  | 'phone'
  | 'users'
  | 'shop'
  | 'calendar'
  | 'user'
  | 'merchant'
  | 'steering'
  | 'megaphone'
  | 'palette'
  | 'video'
  | 'code'
  | 'mail'
  | 'map-pin'
  | 'bell'
  | 'search'
  | 'layers'
  | 'package'
  | 'refund'
  | 'flag'
  | 'shield'
  | 'wallet'
  | 'headset'
  | 'sparkles'
  | 'settings'

type Props = {
  name: VeroIconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}

function IconPath({ name }: { name: VeroIconName }): ReactNode {
  switch (name) {
    case 'car':
      return (
        <>
          <path d="M5 17h14M5 17a2 2 0 01-2-2v-3l2-5h14l2 5v3a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2" />
          <circle cx="7.5" cy="17" r="1.5" />
          <circle cx="16.5" cy="17" r="1.5" />
        </>
      )
    case 'plane':
      return <path d="M2 12h20M12 2l4 10-4 3-4-3 4-10z" />
    case 'truck':
      return (
        <>
          <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
          <circle cx="7" cy="17" r="1.5" />
          <circle cx="18" cy="17" r="1.5" />
        </>
      )
    case 'bike':
      return (
        <>
          <circle cx="6" cy="17" r="3" />
          <circle cx="18" cy="17" r="3" />
          <path d="M6 17l4-7h4l2 3h3M10 10l2-3h3" />
        </>
      )
    case 'forex':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 10h8M8 14h8M10 8v8M14 8v8" />
        </>
      )
    case 'food':
      return (
        <>
          <path d="M4 11h16M6 11V7a2 2 0 014 0v4M10 11V5a2 2 0 014 0v6M14 11V7a2 2 0 014 0v4" />
          <path d="M5 11v6h14v-6" />
        </>
      )
    case 'briefcase':
      return (
        <>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" />
        </>
      )
    case 'bed':
      return (
        <>
          <path d="M3 14v5M21 14v5M3 14h18M3 14v-3a3 3 0 013-3h2a2 2 0 012 2v1h4V10a2 2 0 012-2h2a3 3 0 013 3v3" />
        </>
      )
    case 'home':
      return <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
    case 'store':
      return (
        <>
          <path d="M4 10h16l-1.5-5H5.5L4 10z" />
          <path d="M6 10v9h12v-9M9 19v-4h6v4" />
        </>
      )
    case 'cart':
      return (
        <>
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M3 4h2l2.5 11h11l2-8H7" />
        </>
      )
    case 'chat':
      return <path d="M21 12a8 8 0 01-8 8H8l-5 3V12a8 8 0 018-8h2a8 8 0 018 8z" />
    case 'grid':
      return (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </>
      )
    case 'phone':
      return (
        <>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M11 18h2" />
        </>
      )
    case 'users':
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-1a5 5 0 015-5h2a5 5 0 015 5v1M16 8a3 3 0 010 6M19 20v-1a4 4 0 00-3-3.87" />
        </>
      )
    case 'shop':
      return (
        <>
          <path d="M4 10h16l-1.5-5H5.5L4 10z" />
          <path d="M6 10v9h12v-9" />
        </>
      )
    case 'calendar':
      return (
        <>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
        </>
      )
    case 'user':
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20v-1a7 7 0 0114 0v1" />
        </>
      )
    case 'merchant':
      return (
        <>
          <path d="M4 10h16l-1.5-5H5.5L4 10z" />
          <path d="M6 10v9h12v-9M9 19v-4h6v4" />
        </>
      )
    case 'steering':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
        </>
      )
    case 'megaphone':
      return <path d="M4 10v4l12 6V4L4 10zM18 8a3 3 0 010 8" />
    case 'palette':
      return (
        <>
          <path d="M12 3a9 9 0 109 9c0-2-1.5-3-3-3h-1.5a1.5 1.5 0 01-1.5-1.5V9a3 3 0 00-3-3z" />
          <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="7" r="1" fill="currentColor" stroke="none" />
        </>
      )
    case 'video':
      return (
        <>
          <rect x="3" y="6" width="14" height="12" rx="2" />
          <path d="M17 10l4-2v8l-4-2" />
        </>
      )
    case 'code':
      return <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />
    case 'mail':
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 8l9 6 9-6" />
        </>
      )
    case 'map-pin':
      return (
        <>
          <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      )
    case 'bell':
      return (
        <>
          <path d="M12 4a4 4 0 014 4v3l2 2H6l2-2V8a4 4 0 014-4z" />
          <path d="M10 19a2 2 0 004 0" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l5 5" />
        </>
      )
    case 'layers':
      return (
        <>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 12l9 5 9-5M3 17l9 5 9-5" />
        </>
      )
    case 'package':
      return (
        <>
          <path d="M12 3l9 5v11l-9 5-9-5V8l9-5z" />
          <path d="M12 12l9-5M12 12v11M12 12L3 7" />
        </>
      )
    case 'refund':
      return (
        <>
          <path d="M4 7V4H1" />
          <path d="M4 11a8 8 0 108-8H4" />
        </>
      )
    case 'flag':
      return (
        <>
          <path d="M5 4v16" />
          <path d="M5 4h11l-2 3 2 3H5" />
        </>
      )
    case 'shield':
      return <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
    case 'wallet':
      return (
        <>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M3 11h18M16 15h2" />
        </>
      )
    case 'headset':
      return (
        <>
          <path d="M4 14v-2a8 8 0 0116 0v2" />
          <rect x="3" y="14" width="4" height="6" rx="1" />
          <rect x="17" y="14" width="4" height="6" rx="1" />
        </>
      )
    case 'sparkles':
      return (
        <>
          <path d="M12 3l1.2 4.2L17.5 8.5 13.2 9.7 12 14l-1.2-4.3L6.5 8.5l4.3-1.3L12 3z" />
          <path d="M19 14l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6.6-2.1z" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )
    default:
      return null
  }
}

export function VeroIcon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
  style,
  className,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={style}
    >
      <IconPath name={name} />
    </svg>
  )
}

export function IconBadge({
  name,
  size = 22,
  bg = 'var(--primary-light)',
  color = 'var(--primary-dark)',
}: {
  name: VeroIconName
  size?: number
  bg?: string
  color?: string
}) {
  const box = Math.round(size * 2)
  return (
    <div
      style={{
        width: box,
        height: box,
        borderRadius: 12,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <VeroIcon name={name} size={size} color={color} />
    </div>
  )
}
