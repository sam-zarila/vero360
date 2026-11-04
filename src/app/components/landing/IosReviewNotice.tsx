'use client'

import type { CSSProperties, ReactNode } from 'react'
import { APP_STORE_URL, IOS_WEB_APP_URL } from './veroServices'

const resetButton: CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  textAlign: 'inherit',
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  textDecoration: 'none',
}

/** Opens the iOS install page (hosted web app) so users can install Vero360. */
export function IosStoreCta({
  children,
  className,
  style,
  href,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  href?: string
}) {
  const target = (href || APP_STORE_URL || IOS_WEB_APP_URL).trim()

  return (
    <a
      href={target}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ ...resetButton, ...style }}
    >
      {children}
    </a>
  )
}
