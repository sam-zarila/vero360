import Image from 'next/image'

type LogoProps = {
  height?: number
  showText?: boolean
  textColor?: string
}

export default function Logo({ height = 40, showText = true, textColor }: LogoProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Image
        src="/logo.png"
        alt="Vero360"
        width={height}
        height={height}
        style={{ height, width: 'auto', objectFit: 'contain' }}
        priority
      />
      {showText && (
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: height * 0.55, letterSpacing: '-0.5px',
          color: textColor,
        }}>Vero360</span>
      )}
    </span>
  )
}
