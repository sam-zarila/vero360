'use client'

import { useEffect } from 'react'

const NAV_OFFSET = 88

export function scrollToHashTarget(href: string) {
  if (typeof window === 'undefined') return false
  const hash = href.startsWith('/#') ? href.slice(2) : href.startsWith('#') ? href.slice(1) : ''
  if (!hash || window.location.pathname !== '/') return false
  const el = document.getElementById(decodeURIComponent(hash))
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  const next = `/#${hash}`
  if (`${window.location.pathname}${window.location.hash}` !== next) {
    history.pushState(null, '', next)
  }
  return true
}

export function HashScroll() {
  useEffect(() => {
    const run = () => {
      const hash = window.location.hash
      if (!hash) return
      scrollToHashTarget(hash)
    }
    const timer = window.setTimeout(run, 60)
    window.addEventListener('hashchange', run)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('hashchange', run)
    }
  }, [])
  return null
}
