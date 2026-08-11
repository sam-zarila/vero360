'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ensureSession,
  getOrCreateSessionId,
  replyTargetFromMessage,
  sendVisitorImage,
  sendVisitorMessage,
  subscribeToMessages,
  type VeroChatMessageView,
  type VeroChatReplyTo,
} from '@/lib/verochat'
import VeroChatMessageRow from './VeroChatMessageRow'
import VeroChatReplyBar from './VeroChatReplyBar'

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '265992695612'

export default function VeroChat() {
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<VeroChatMessageView[]>([])
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<VeroChatReplyTo | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsDetails, setNeedsDetails] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSessionId(getOrCreateSessionId())
  }, [])

  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener('verochat:open', openChat)
    return () => window.removeEventListener('verochat:open', openChat)
  }, [])

  useEffect(() => {
    if (!open || !sessionId) return
    return subscribeToMessages(sessionId, setMessages)
  }, [open, sessionId])

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, needsDetails])

  const visitor = () => ({ name: name.trim(), email: email.trim() })

  const requireDetails = (text: string) => {
    if (name.trim() && email.trim()) return false
    if (!needsDetails) {
      setPendingMessage(text)
      setNeedsDetails(true)
      setInput('')
    }
    return true
  }

  const deliverMessage = async (text: string, reply?: VeroChatReplyTo | null) => {
    setLoading(true)
    setError('')
    try {
      await ensureSession(sessionId, name.trim(), email.trim())
      await sendVisitorMessage(sessionId, text, visitor(), reply ?? undefined)
      setInput('')
      setPendingMessage('')
      setNeedsDetails(false)
      setReplyTo(null)
    } catch {
      setError('Could not send message. Please try again or use WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  const deliverImage = async (file: File, caption?: string, reply?: VeroChatReplyTo | null) => {
    setLoading(true)
    setError('')
    try {
      await ensureSession(sessionId, name.trim(), email.trim())
      await sendVisitorImage(sessionId, file, {
        caption,
        visitor: visitor(),
        replyTo: reply ?? undefined,
      })
      setInput('')
      setPendingMessage('')
      setNeedsDetails(false)
      setReplyTo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo. Please try again or use WhatsApp.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const text = (needsDetails ? pendingMessage : input).trim()
    if (!text || loading || !sessionId) return

    if (requireDetails(text)) return

    await deliverMessage(text, replyTo)
  }

  const handlePhoto = async (file: File | undefined) => {
    if (!file || loading || !sessionId) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    if (!name.trim() || !email.trim()) {
      setNeedsDetails(true)
      setError('Enter your name and email before sending a photo.')
      return
    }

    const caption = (needsDetails ? pendingMessage : input).trim()
    await deliverImage(file, caption || undefined, replyTo)
  }

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent('Hi Vero360, I need help with...')}`

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Vero360 Help Center"
          className="verochat-fab"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 150,
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--primary)', color: '#fff',
            border: 'none', boxShadow: '0 8px 32px rgba(249,115,22,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a7 7 0 00-7 7v1.5a2.5 2.5 0 01-2.5 2.5H3a1 1 0 000 2h.5A4.5 4.5 0 008 11.5V10a4 4 0 118 0v1.5a4.5 4.5 0 004.5 4.5H21a1 1 0 000-2h-.5A2.5 2.5 0 0118 11.5V10a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
          </svg>
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 12, height: 12, borderRadius: '50%',
            background: '#22C55E', border: '2px solid #fff',
          }} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Vero360 Help Center"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 150,
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(520px, calc(100vh - 48px))',
            background: '#fff', borderRadius: 20,
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a7 7 0 00-7 7v1.5a2.5 2.5 0 01-2.5 2.5H3a1 1 0 000 2h.5A4.5 4.5 0 008 11.5V10a4 4 0 118 0v1.5a4.5 4.5 0 004.5 4.5H21a1 1 0 000-2h-.5A2.5 2.5 0 0118 11.5V10a7 7 0 00-7-7z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9.5 19a2.5 2.5 0 005 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="1.2" fill="#fff"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-display)' }}>
                Vero360 Help Center
              </div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                Live agent online
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Help Center"
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                borderRadius: 8, width: 32, height: 32,
                color: '#fff', fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{
                alignSelf: 'flex-start', maxWidth: '85%',
                padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                background: '#fff', border: '1px solid var(--border)',
                fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5,
              }}>
                Hello! This is Vero360 Help Center. Chat with us — how can we help?
              </div>
            )}

            {messages.map(msg => (
              <VeroChatMessageRow
                key={msg.id}
                msg={msg}
                alignEnd={msg.sender === 'visitor'}
                showReply
                onReply={() => setReplyTo(replyTargetFromMessage(msg))}
              />
            ))}

            {needsDetails && (
              <div style={{
                background: '#fff', borderRadius: 12, padding: 14,
                border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
                  Share your details so our agent can follow up:
                </p>
                <input
                  type="text"
                  placeholder="Your name"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', fontSize: 14, marginBottom: 8,
                  }}
                />
                <input
                  type="email"
                  placeholder="Your email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', fontSize: 14,
                  }}
                />
              </div>
            )}

            {error && (
              <p style={{ fontSize: 13, color: 'var(--error)', textAlign: 'center' }}>{error}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 16px', margin: '0 14px',
              background: '#ECFDF5', borderRadius: 10,
              color: '#166534', fontSize: 13, fontWeight: 600,
              border: '1px solid #BBF7D0',
            }}
          >
            <span>💬</span> Or chat on WhatsApp
          </a>

          {replyTo && <VeroChatReplyBar replyTo={replyTo} onClear={() => setReplyTo(null)} viewer="visitor" />}

          <form
            onSubmit={handleSend}
            style={{
              padding: 14,
              borderTop: replyTo ? 'none' : '1px solid var(--border)',
              display: 'flex', gap: 8, background: '#fff', alignItems: 'center',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => handlePhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              title="Send photo"
              aria-label="Send photo"
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1.5px solid var(--border)',
                background: '#fff',
                fontSize: 18,
                lineHeight: 1,
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              📷
            </button>
            <input
              type="text"
              value={needsDetails ? pendingMessage : input}
              onChange={e => needsDetails ? setPendingMessage(e.target.value) : setInput(e.target.value)}
              placeholder={needsDetails ? 'Your message…' : 'Message Help Center…'}
              disabled={loading}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 12,
                border: '1.5px solid var(--border)', fontSize: 14, outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !(needsDetails ? pendingMessage : input).trim()}
              style={{
                padding: '12px 16px', borderRadius: 12, border: 'none',
                background: 'var(--primary)', color: '#fff',
                fontWeight: 700, fontSize: 14,
                opacity: loading || !(needsDetails ? pendingMessage : input).trim() ? 0.6 : 1,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <style>{`
        .verochat-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 40px rgba(249,115,22,0.5) !important;
        }
        @media (max-width: 480px) {
          [role="dialog"][aria-label="Vero360 Help Center"] {
            bottom: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  )
}
