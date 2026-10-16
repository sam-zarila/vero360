import Image from 'next/image'

type LogoProps = {
  height?: number
  showText?: boolean
  textColor?: string
}

export default function Logo({ height = 52 }: LogoProps) {
  const radius = Math.round(height * 0.22)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#fff',
        borderRadius: radius,
        lineHeight: 0,
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.14)',
      }}
    >
      <Image
        src="/logo-white.png"
        alt="Vero's 360"
        width={height}
        height={height}
        style={{ height, width: height, objectFit: 'contain', borderRadius: radius }}
        priority
      />
    </span>
  )
}
