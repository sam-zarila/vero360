'use client'

import { formatChatTime, type VeroChatMessageView } from '@/lib/verochat'

type Props = {
  msg: VeroChatMessageView
  /** Bubble on the right (visitor or agent depending on view) */
  alignEnd: boolean
  showReply?: boolean
  onReply?: () => void
}

export default function VeroChatMessageRow({ msg, alignEnd, showReply, onReply }: Props) {
  const isAgent = msg.sender === 'agent'
  const bubbleBg = alignEnd ? 'var(--primary)' : '#fff'
  const bubbleColor = alignEnd ? '#fff' : 'var(--text-2)'
  const bubbleBorder = alignEnd ? 'none' : '1px solid var(--border)'
  const radius = alignEnd ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
  const quoteBg = alignEnd ? 'rgba(255,255,255,0.18)' : 'var(--surface)'
  const quoteBorder = alignEnd ? 'rgba(255,255,255,0.35)' : 'var(--primary)'

  return (
    <div
      style={{
        alignSelf: alignEnd ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        position: 'relative',
      }}
      className="verochat-msg-row"
    >
      {isAgent && msg.agentName && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--primary)',
            fontWeight: 700,
            marginBottom: 4,
            textAlign: alignEnd ? 'right' : 'left',
          }}
        >
          {msg.agentName}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {showReply && onReply && (
          <button
            type="button"
            onClick={onReply}
            title="Reply to this message"
            className="verochat-reply-btn"
            style={{
              position: 'absolute',
              top: -6,
              [alignEnd ? 'left' : 'right']: -4,
              transform: alignEnd ? 'translateX(-100%)' : 'translateX(100%)',
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#fff',
              color: 'var(--text-3)',
              cursor: 'pointer',
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
          >
            Reply
          </button>
        )}

        <div
          style={{
            padding: '10px 14px',
            borderRadius: radius,
            background: bubbleBg,
            color: bubbleColor,
            fontSize: 14,
            lineHeight: 1.5,
            border: bubbleBorder,
          }}
        >
          {msg.replyTo && (
            <div
              style={{
                marginBottom: 8,
                padding: '6px 10px',
                borderRadius: 8,
                background: quoteBg,
                borderLeft: `3px solid ${quoteBorder}`,
                fontSize: 12,
                opacity: 0.92,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 11 }}>
                {msg.replyTo.sender === 'agent' ? 'Help Center' : 'You'}
              </div>
              <div
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 220,
                }}
              >
                {msg.replyTo.text || '📷 Photo'}
              </div>
            </div>
          )}

          {msg.kind === 'image' && msg.imageUrl && (
            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt={msg.text || 'Shared photo'}
                style={{
                  maxWidth: '100%',
                  maxHeight: 240,
                  borderRadius: 8,
                  display: 'block',
                  marginBottom: msg.text ? 8 : 0,
                }}
              />
            </a>
          )}

          {msg.text ? <div>{msg.text}</div> : null}
        </div>
      </div>

      <div
        style={{
          fontSize: 10,
          color: 'var(--text-4)',
          marginTop: 4,
          textAlign: alignEnd ? 'right' : 'left',
        }}
      >
        {formatChatTime(msg.createdAt)}
      </div>

      <style>{`
        .verochat-msg-row:hover .verochat-reply-btn {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
