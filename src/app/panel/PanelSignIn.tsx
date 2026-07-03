'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

export default function PanelSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Auth integration point — wire to your admin API when ready
    setTimeout(() => setLoading(false), 800)
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: 'linear-gradient(135deg, #9A3412 0%, #F97316 40%, #FFF7ED 100%)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 24,
        padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', marginBottom: 24 }}>
            <Logo height={44} showText={false} />
          </Link>
          <h1 style={{
            fontSize: 26, fontWeight: 800, marginBottom: 8,
            fontFamily: 'var(--font-display)', color: 'var(--text)',
          }}>
            Sign in
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Enter your credentials to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label htmlFor="email" style={{
              display: 'block', fontSize: 13, fontWeight: 600,
              color: 'var(--text-2)', marginBottom: 8,
            }}>
              Email or username
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@vero360.com"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1.5px solid var(--border)', fontSize: 15,
                outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.15)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{
              display: 'block', fontSize: 13, fontWeight: 600,
              color: 'var(--text-2)', marginBottom: 8,
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1.5px solid var(--border)', fontSize: 15,
                outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.15)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="panel-sign-in-btn"
            style={{
              marginTop: 8, padding: '14px 24px', borderRadius: 12,
              width: '100%',
              border: 'none',
              background: loading ? 'var(--primary-light)' : 'var(--primary)',
              color: '#fff', fontWeight: 700, fontSize: 16,
              boxShadow: 'var(--shadow-primary)',
              transition: 'background 0.2s, transform 0.2s',
              opacity: loading ? 0.8 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <style>{`
          .panel-sign-in-btn:hover:not(:disabled) {
            background: var(--primary-dark) !important;
            transform: translateY(-1px);
          }
        `}</style>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14 }}>
          <Link href="/" style={{ color: 'var(--text-3)', fontWeight: 500 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
