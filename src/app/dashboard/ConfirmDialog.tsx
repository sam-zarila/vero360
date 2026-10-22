'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { panelPasswordError, reauthPanelPassword } from '@/lib/panel-reauth'

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** When true, the admin must re-enter their /panel password. */
  requirePassword?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>
type ConfirmDeleteFn = (itemLabel: string, detail?: string) => Promise<string | false>

type ConfirmContextValue = {
  confirm: ConfirmFn
  confirmDelete: ConfirmDeleteFn
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

function normalizeOptions(options: ConfirmOptions | string): ConfirmOptions {
  if (typeof options === 'string') {
    return {
      title: 'Confirm',
      message: options,
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      danger: true,
      requirePassword: false,
    }
  }
  return {
    title: options.title ?? 'Confirm',
    message: options.message,
    confirmLabel: options.confirmLabel ?? (options.danger === false ? 'Yes' : 'Yes, delete'),
    cancelLabel: options.cancelLabel ?? 'No',
    danger: options.danger !== false,
    requirePassword: options.requirePassword === true,
  }
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({
    message: '',
    title: 'Confirm',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
    danger: true,
    requirePassword: false,
  })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const passwordResolver = useRef<((value: string | false) => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const confirm = useCallback<ConfirmFn>(options => {
    const next = normalizeOptions(options)
    setOpts(next)
    setPassword('')
    setError('')
    setBusy(false)
    setOpen(true)
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
      passwordResolver.current = null
    })
  }, [])

  const confirmDelete = useCallback<ConfirmDeleteFn>((itemLabel, detail) => {
    const next = normalizeOptions({
      title: 'Delete?',
      message: detail
        ? `Delete “${itemLabel}”?\n\n${detail}`
        : `Delete “${itemLabel}”?\n\nThis cannot be undone.`,
      confirmLabel: 'Yes, delete',
      cancelLabel: 'No',
      danger: true,
      requirePassword: true,
    })
    setOpts(next)
    setPassword('')
    setError('')
    setBusy(false)
    setOpen(true)
    return new Promise<string | false>(resolve => {
      passwordResolver.current = resolve
      resolver.current = null
    })
  }, [])

  const finish = (ok: boolean, verifiedPassword = '') => {
    setOpen(false)
    setPassword('')
    setError('')
    setBusy(false)
    resolver.current?.(ok)
    passwordResolver.current?.(ok && verifiedPassword ? verifiedPassword : false)
    resolver.current = null
    passwordResolver.current = null
  }

  const onCancel = () => {
    if (busy) return
    finish(false)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (opts.requirePassword) {
      const typed = password
      if (!typed) {
        setError('Enter your admin password to delete.')
        return
      }
      setBusy(true)
      setError('')
      try {
        await reauthPanelPassword(typed)
        finish(true, typed)
      } catch (err) {
        setError(panelPasswordError(err))
        setBusy(false)
      }
      return
    }
    finish(true)
  }

  useEffect(() => {
    if (!open || !opts.requirePassword) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open, opts.requirePassword])

  const value = useMemo(() => ({ confirm, confirmDelete }), [confirm, confirmDelete])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          style={overlay}
          onClick={onCancel}
        >
          <form style={card} onClick={e => e.stopPropagation()} onSubmit={e => void onSubmit(e)}>
            <h2 id="confirm-dialog-title" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
              {opts.title}
            </h2>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 14,
                color: '#4B5563',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {opts.message}
            </p>
            {opts.requirePassword ? (
              <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                  Admin password
                </span>
                <input
                  ref={inputRef}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    if (error) setError('')
                  }}
                  required
                  disabled={busy}
                  placeholder="Same password you use at /panel"
                  style={passwordInput}
                />
              </label>
            ) : null}
            {error ? (
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
                {error}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={onCancel} disabled={busy} style={btnNo}>
                {opts.cancelLabel}
              </button>
              <button
                type="submit"
                disabled={busy || (opts.requirePassword && !password)}
                style={{
                  ...btnYes,
                  background: opts.danger ? '#B91C1C' : '#0F766E',
                  opacity: busy || (opts.requirePassword && !password) ? 0.65 : 1,
                }}
              >
                {busy ? 'Checking…' : opts.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    return async (options: ConfirmOptions | string) => {
      const message = typeof options === 'string' ? options : options.message
      return window.confirm(message)
    }
  }
  return ctx.confirm
}

/** Ask Yes/No and require the admin panel password before deleting. */
export function useConfirmDelete() {
  const ctx = useContext(ConfirmContext)
  return useCallback(
    async (itemLabel: string, detail?: string): Promise<string | false> => {
      if (!ctx) {
        const message = detail
          ? `Delete “${itemLabel}”?\n\n${detail}`
          : `Delete “${itemLabel}”?\n\nThis cannot be undone.`
        if (!window.confirm(message)) return false
        const typed = window.prompt('Enter your admin password to delete:')
        if (!typed) return false
        try {
          await reauthPanelPassword(typed)
          return typed
        } catch (err) {
          window.alert(panelPasswordError(err))
          return false
        }
      }
      return ctx.confirmDelete(itemLabel, detail)
    },
    [ctx],
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

const passwordInput: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  padding: '10px 12px',
  fontSize: 15,
  background: '#F9FAFB',
  fontFamily: 'inherit',
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
