'use client'

import type { VeroChatReplyTo } from '@/lib/verochat'

type Props = {
  replyTo: VeroChatReplyTo
  onClear: () => void
  /** Who is reading the chat — affects reply label for visitor messages */
  viewer?: 'agent' | 'visitor'
}

function replyLabel(replyTo: VeroChatReplyTo, viewer: 'agent' | 'visitor') {
  if (replyTo.sender === 'agent') return 'Help Center'
  return viewer === 'visitor' ? 'your message' : 'visitor'
}

export default function VeroChatReplyBar({ replyTo, onClear, viewer = 'agent' }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12, marginBottom: 2 }}>
          Replying to {replyLabel(replyTo, viewer)}
        </div>
        <div
          style={{
            color: 'var(--text-3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {replyTo.text || '📷 Photo'}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Cancel reply"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-4)',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '0 4px',
        }}
      >
        ×
      </button>
    </div>
  )
}
