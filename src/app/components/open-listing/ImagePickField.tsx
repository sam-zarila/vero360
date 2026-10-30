'use client'

import { useRef, type CSSProperties } from 'react'

const wrap: CSSProperties = {
  marginBottom: 8,
  padding: '10px 12px',
  borderRadius: 12,
  background: '#fff',
}

const btn: CSSProperties = {
  flex: 1,
  padding: '10px 8px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#FFF7ED',
  color: '#9A3412',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function ImagePickField({
  label,
  ready,
  busy,
  onFile,
}: {
  label: string
  ready: boolean
  busy: boolean
  onFile: (file: File | undefined) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function take(file: File | undefined) {
    onFile(file)
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div
      style={{
        ...wrap,
        border: `1px solid ${ready ? '#F97316' : 'var(--border)'}`,
        background: ready ? '#FFF7ED' : '#fff',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        {busy ? `${label} · uploading…` : ready ? `${label} · attached` : label}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          style={btn}
        >
          Take photo
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          style={btn}
        >
          Upload from files
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={e => take(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={e => take(e.target.files?.[0])}
      />
    </div>
  )
}
