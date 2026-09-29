'use client'

import { Suspense } from 'react'
import AdminAgentRegistrationsInner from './RegistrationsInner'

export default function AdminAgentRegistrationsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, fontWeight: 600, color: 'var(--text-3)' }}>Loading…</div>
      }
    >
      <AdminAgentRegistrationsInner />
    </Suspense>
  )
}
