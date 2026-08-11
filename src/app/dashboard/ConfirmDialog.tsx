'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({
    message: '',
    title: 'Confirm',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
    danger: true,
  })
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(options => {
    const next: ConfirmOptions =
      typeof options === 'string'
        ? {
            title: 'Confirm delete',
            message: options,
            confirmLabel: 'Yes, delete',
            cancelLabel: 'No',
            danger: true,
          }
        : {
            title: options.title ?? 'Confirm',
            message: options.message,
            confirmLabel: options.confirmLabel ?? (options.danger === false ? 'Yes' : 'Yes, delete'),
            cancelLabel: options.cancelLabel ?? 'No',
            danger: options.danger !== false,
          }

    setOpts(next)
    setOpen(true)
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    setOpen(false)
    resolver.current?.(value)
    resolver.current = null
  }

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          style={overlay}
          onClick={() => close(false)}
        >
          <div style={card} onClick={e => e.stopPropagation()}>
            <h2 id="confirm-dialog-title" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
              {opts.title}
            </h2>
            <p
              style={{
                margin: '0 0 20px',
                fontSize: 14,
                color: '#4B5563',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {opts.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => close(false)} style={btnNo}>
                {opts.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                style={{
                  ...btnYes,
                  background: opts.danger ? '#B91C1C' : '#0F766E',
                }}
              >
                {opts.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    // Fallback if used outside provider
    return async (options: ConfirmOptions | string) => {
      const message = typeof options === 'string' ? options : options.message
      return window.confirm(message)
    }
  }
  return ctx
}

/** Convenience: ask Yes/No before deleting something. */
export function useConfirmDelete() {
  const confirm = useConfirm()
  return useCallback(
    async (itemLabel: string, detail?: string) => {
      return confirm({
        title: 'Delete?',
        message: detail
          ? `Delete “${itemLabel}”?\n\n${detail}`
          : `Delete “${itemLabel}”?\n\nThis cannot be undone.`,
        confirmLabel: 'Yes, delete',
        cancelLabel: 'No',
        danger: true,
      })
    },
    [confirm],
  )
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
}

const card: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  borderRadius: 16,
  padding: '22px 20px',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
  border: '1px solid #E5E7EB',
}

const btnNo: CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#fff',
  color: '#374151',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 88,
}

const btnYes: CSSProperties = {
  border: 'none',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 110,
}
