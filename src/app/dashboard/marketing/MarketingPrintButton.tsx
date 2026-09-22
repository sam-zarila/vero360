'use client'

import type { CSSProperties, ReactNode } from 'react'

type Props = {
  /** Shown in the print header and temporary document title. */
  title: string
  subtitle?: string
  style?: CSSProperties
}

/** Opens the browser print dialog for the current marketing report view. */
export function MarketingPrintButton({ title, subtitle, style }: Props) {
  const onPrint = () => {
    const prev = document.title
    document.title = `${title} · Vero360`
    const restore = () => {
      document.title = prev
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <>
      <button
        type="button"
        className="no-print"
        onClick={onPrint}
        style={{ ...printBtnStyle, ...style }}
      >
        Print
      </button>
      <div className="marketing-print-banner print-only" aria-hidden>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#9A3412' }}>Vero360 Marketing</p>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{title}</h1>
        {subtitle ? (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>{subtitle}</p>
        ) : null}
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94A3B8' }}>
          Printed {new Date().toLocaleString()}
        </p>
      </div>
      <style>{MARKETING_PRINT_CSS}</style>
    </>
  )
}

export function MarketingPrintMeta({ children }: { children: ReactNode }) {
  return <div className="marketing-print-meta print-only">{children}</div>
}

const printBtnStyle: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 100,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const MARKETING_PRINT_CSS = `
  .print-only { display: none !important; }

  @media print {
    @page {
      size: A4 landscape;
      margin: 12mm;
    }

    .print-only { display: block !important; }
    .no-print { display: none !important; }

    .dashboard-sidebar,
    .dashboard-sidebar-backdrop,
    .dashboard-menu-btn,
    .dashboard-sidebar-mobile-head {
      display: none !important;
    }

    body {
      background: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .marketing-print-banner {
      margin: 0 0 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #F97316;
    }

    .marketing-print-meta {
      margin: 0 0 14px;
      font-size: 12px;
      color: #475569;
    }

    table {
      width: 100% !important;
      min-width: 0 !important;
      border-collapse: collapse !important;
    }

    th, td {
      border: 1px solid #E2E8F0 !important;
      padding: 6px 8px !important;
      font-size: 11px !important;
      color: #0F172A !important;
    }

    th {
      background: #FFF7ED !important;
      font-weight: 800 !important;
    }

    a { color: inherit !important; text-decoration: none !important; }

    button, input, select, textarea {
      box-shadow: none !important;
    }
  }
`
