'use client'

import { notifyBrowser } from '@/lib/admin-browser-notify'
import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 15_000

export type CarHireAlertState = {
  companies: number
  listings: number
  leads: number
  toast: string | null
  clearToast: () => void
}

export function useCarHireAlerts(enabled = true): CarHireAlertState {
  const [companies, setCompanies] = useState(0)
  const [listings, setListings] = useState(0)
  const [leads, setLeads] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const last = useRef({ companies: 0, listings: 0, leads: 0 })
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/car-hire/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          pendingReview?: number
          companiesQueue?: number
          newLeads?: number
        }
        if (cancelled) return

        const nextListings = Number(data.pendingReview) || 0
        const nextCompanies = Number(data.companiesQueue) || 0
        const nextLeads = Number(data.newLeads) || 0
        setListings(nextListings)
        setCompanies(nextCompanies)
        setLeads(nextLeads)

        if (!primed.current) {
          primed.current = true
          last.current = {
            companies: nextCompanies,
            listings: nextListings,
            leads: nextLeads,
          }
          return
        }

        const parts: string[] = []
        if (nextCompanies > last.current.companies) {
          const delta = nextCompanies - last.current.companies
          parts.push(
            delta === 1 ? '1 car-hire company needs review' : `${delta} car-hire companies need review`,
          )
        }
        if (nextListings > last.current.listings) {
          const delta = nextListings - last.current.listings
          parts.push(
            delta === 1 ? '1 car-hire listing needs review' : `${delta} car-hire listings need review`,
          )
        }
        if (nextLeads > last.current.leads) {
          const delta = nextLeads - last.current.leads
          parts.push(delta === 1 ? '1 new car-hire lead' : `${delta} new car-hire leads`)
        }
        last.current = {
          companies: nextCompanies,
          listings: nextListings,
          leads: nextLeads,
        }
        if (!parts.length) return
        const message = parts.join('. ')
        setToast(message)
        notifyBrowser('Car Hire', message, 'vero-car-hire')
      } catch {
        // keep last known
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    const onFocus = () => void poll()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled])

  return { companies, listings, leads, toast, clearToast }
}
