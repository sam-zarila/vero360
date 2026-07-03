'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import DownloadAppModal from './DownloadAppModal'
import Logo from './Logo'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Explore services', href: '/#services' },
  { label: 'Contact', href: '/#contact' },
  { label: 'About us', href: '/#about-us' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openDownload = () => {
    setMenuOpen(false)
    setDownloadOpen(true)
  }

  const linkStyle = (isScrolled: boolean) => ({
    padding: '8px 16px', borderRadius: 8,
    fontSize: 15, fontWeight: 500,
    color: isScrolled ? 'var(--text-2)' : 'rgba(255,255,255,0.85)',
    transition: 'all 0.2s',
  } as const)

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(255,255,255,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 72,
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Logo height={38} textColor={scrolled ? 'var(--text)' : '#fff'} />
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="nav-links">
            {navLinks.map(link => (
              <Link key={link.label} href={link.href} style={linkStyle(scrolled)}
                onMouseEnter={e => (e.currentTarget.style.background = scrolled ? 'var(--surface-2)' : 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{link.label}</Link>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="nav-cta">
            <Link href="/get-started" style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: scrolled ? 'var(--primary)' : '#fff',
              border: `1.5px solid ${scrolled ? 'var(--primary)' : 'rgba(255,255,255,0.5)'}`,
              transition: 'all 0.2s',
            }}>Get started</Link>
            <button
              onClick={openDownload}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: scrolled ? 'var(--primary)' : '#fff',
                color: scrolled ? '#fff' : 'var(--primary-dark)',
                boxShadow: scrolled ? 'var(--shadow-primary)' : '0 2px 8px rgba(255,255,255,0.3)',
                transition: 'all 0.2s',
              }}
            >Download app</button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="nav-hamburger"
            style={{ display: 'none', flexDirection: 'column', gap: 5, padding: 8 }}
            aria-label="Toggle menu"
          >
            {[0,1,2].map(i => (
              <span key={i} style={{
                display: 'block', width: 22, height: 2,
                background: scrolled ? 'var(--text)' : '#fff',
                borderRadius: 2, transition: 'all 0.2s',
                transform: menuOpen
                  ? i === 0 ? 'rotate(45deg) translate(5px,5px)'
                  : i === 2 ? 'rotate(-45deg) translate(5px,-5px)'
                  : 'scaleX(0)'
                  : 'none',
              }}/>
            ))}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={{
          position: 'fixed', top: 72, left: 0, right: 0, zIndex: 99,
          background: '#fff', borderBottom: '1px solid var(--border)',
          padding: '16px 24px 24px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {navLinks.map(link => (
            <Link key={link.label} href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block', padding: '14px 0',
                fontSize: 16, fontWeight: 500, color: 'var(--text-2)',
                borderBottom: '1px solid var(--border)',
              }}>{link.label}</Link>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Link href="/get-started" onClick={() => setMenuOpen(false)} style={{
              flex: 1, textAlign: 'center', padding: '12px',
              border: '1.5px solid var(--primary)', borderRadius: 10,
              color: 'var(--primary)', fontWeight: 600, fontSize: 15,
            }}>Get started</Link>
            <button
              onClick={openDownload}
              style={{
                flex: 1, padding: '12px',
                background: 'var(--primary)', borderRadius: 10,
                color: '#fff', fontWeight: 600, fontSize: 15,
              }}
            >Download app</button>
          </div>
        </div>
      )}

      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />

      <style>{`
        @media (max-width: 768px) {
          .nav-links, .nav-cta { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
