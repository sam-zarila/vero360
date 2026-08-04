'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  closeSession,
  formatChatTime,
  isHelpCenterSession,
  markSessionRead,
  sendAgentMessage,
  subscribeToMessages,
  subscribeToSessions,
  type VeroChatMessageView,
  type VeroChatSessionView,
} from '@/lib/verochat'

export default function HelpCenterInbox() {
  const [sessions, setSessions] = useState<VeroChatSessionView[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<VeroChatMessageView[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const chatSessions = sessions.filter(isHelpCenterSession)
  const active = chatSessions.find(s => s.id === activeId) ?? null

  useEffect(() => {
    return subscribeToSessions(setSessions)
  }, [])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    const unsub = subscribeToMessages(activeId, setMessages)
    markSessionRead(activeId).catch(() => {})
    return unsub
  }, [activeId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeId])

  useEffect(() => {
    if (activeId) return
    if (chatSessions.length > 0) setActiveId(chatSessions[0]!.id)
  }, [activeId, chatSessions])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeId || !input.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      await sendAgentMessage(activeId, input)
      setInput('')
    } catch {
      setError('Could not send reply. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    if (!activeId) return
    try {
      await closeSession(activeId)
    } catch {
      setError('Could not close chat.')
    }
  }

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-3)',
          marginBottom: 20,
        }}
      >
        ← Back to dashboard
      </Link>

      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 'clamp(24px, 3vw, 32px)',
            fontWeight: 900,
            letterSpacing: '-0.4px',
            marginBottom: 6,
          }}
        >
          Help Center
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', margin: 0 }}>
          Live Vero360 Help Center chats from the website.
        </p>
      </div>

      <div
        className="help-inbox"
        style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: 16,
          minHeight: 'min(70vh, 680px)',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <aside
          style={{
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-2)',
            }}
          >
            Conversations ({chatSessions.length})
          </div>

          {chatSessions.length === 0 ? (
            <p style={{ padding: 20, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
              No live chats yet. When visitors use Help Center on the site, they will show up here.
            </p>
          ) : (
            chatSessions.map(session => {
              const selected = session.id === activeId
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: selected ? '#fff' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: selected ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {session.visitorName || 'Visitor'}
                    </span>
                    {session.unreadForAgent > 0 && (
                      <span
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 100,
                          background: 'var(--primary)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 6px',
                        }}
                      >
                        {session.unreadForAgent}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 4 }}>
                    {session.visitorEmail || 'No email'} · {session.status}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {session.lastMessage || 'No messages yet'}
                  </div>
                </button>
              )
            })
          )}
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!active ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-3)',
                fontSize: 15,
                padding: 24,
              }}
            >
              Select a conversation to reply.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{active.visitorName || 'Visitor'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{active.visitorEmail}</div>
                </div>
                {active.status === 'open' && (
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-2)',
                    }}
                  >
                    Close chat
                  </button>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 18,
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === 'agent' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                    }}
                  >
                    {msg.sender === 'agent' && msg.agentName && (
                      <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginBottom: 4, textAlign: 'right' }}>
                        {msg.agentName}
                      </div>
                    )}
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: msg.sender === 'agent' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.sender === 'agent' ? 'var(--primary)' : '#fff',
                        color: msg.sender === 'agent' ? '#fff' : 'var(--text-2)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        border: msg.sender === 'visitor' ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {msg.text}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-4)',
                        marginTop: 4,
                        textAlign: msg.sender === 'agent' ? 'right' : 'left',
                      }}
                    >
                      {formatChatTime(msg.createdAt)}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {error && (
                <p style={{ margin: 0, padding: '8px 18px 0', fontSize: 13, color: 'var(--error)' }}>
                  {error}
                </p>
              )}

              <form
                onSubmit={handleSend}
                style={{
                  padding: 14,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  gap: 8,
                  background: '#fff',
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Reply as Help Center…"
                  disabled={loading || active.status === 'closed'}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid var(--border)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim() || active.status === 'closed'}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    opacity: loading || !input.trim() || active.status === 'closed' ? 0.6 : 1,
                  }}
                >
                  {loading ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .help-inbox {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
          .help-inbox > aside {
            max-height: 240px;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
          }
          .help-inbox > section {
            min-height: 420px;
          }
        }
      `}</style>
    </div>
  )
}
