'use client'

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'
import {
  GET_STARTED_ROLE_META,
  GET_STARTED_ROLES,
  emptyGetStartedVideosMap,
  videoKindLabel,
  type GetStartedRoleId,
  type GetStartedVideo,
  type GetStartedVideosMap,
} from '@/lib/get-started-videos'
import { IconBadge } from '@/app/components/landing/icons'
import { useConfirmDelete } from '../ConfirmDialog'
import { usePanelSession } from '../PanelSessionProvider'

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  fontSize: 15,
  outline: 'none',
  background: '#fff',
  color: 'var(--text)',
}

export default function GetStartedVideosAdminPage() {
  const confirmDelete = useConfirmDelete()
  const { loading: sessionLoading, authenticated } = usePanelSession()
  const [videos, setVideos] = useState<GetStartedVideosMap>(emptyGetStartedVideosMap())
  const [links, setLinks] = useState<Record<GetStartedRoleId, string>>({
    customer: '',
    merchant: '',
    driver: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/get-started-videos', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load videos')
      setVideos(data.videos || emptyGetStartedVideosMap())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    if (!authenticated) {
      setLoading(false)
      setError('Sign in at /panel to manage Get started videos.')
      return
    }
    void load()
  }, [sessionLoading, authenticated, load])

  const setVideo = (video: GetStartedVideo) => {
    setVideos(prev => ({ ...prev, [video.role]: video }))
  }

  const saveLink = async (e: FormEvent, role: GetStartedRoleId) => {
    e.preventDefault()
    setBusy(`link-${role}`)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders(true)
      const res = await adminFetch('/api/admin/get-started-videos', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role, url: links[role] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save link')
      setVideo(data.video)
      setLinks(prev => ({ ...prev, [role]: '' }))
      setNotice(`${GET_STARTED_ROLE_META[role].title} video saved`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save link')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (role: GetStartedRoleId) => {
    if (!(await confirmDelete(`${GET_STARTED_ROLE_META[role].title} tutorial`, 'It will show “coming soon” on the site until you add another video.'))) {
      return
    }
    setBusy(`del-${role}`)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch(`/api/admin/get-started-videos?role=${role}`, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not remove video')
      setVideos(prev => ({
        ...prev,
        [role]: { role, url: null, embedUrl: null, kind: null, fileName: null, updatedAt: null },
      }))
      setNotice(`${GET_STARTED_ROLE_META[role].title} video removed`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove video')
    } finally {
      setBusy(null)
    }
  }

  const uploadFile = async (role: GetStartedRoleId, file: File) => {
    setBusy(`up-${role}`)
    setProgress(prev => ({ ...prev, [role]: 0 }))
    setError('')
    setNotice('')
    try {
      const startHeaders = await panelAuthHeaders(true)
      const startRes = await adminFetch('/api/admin/get-started-videos/upload', {
        method: 'POST',
        headers: startHeaders,
        body: JSON.stringify({
          action: 'start',
          role,
          contentType: file.type || 'video/mp4',
          fileName: file.name,
          size: file.size,
        }),
      })
      const startData = await startRes.json()
      if (!startRes.ok) throw new Error(startData.error || 'Could not start upload')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', startData.uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        xhr.upload.onprogress = ev => {
          if (!ev.lengthComputable) return
          setProgress(prev => ({ ...prev, [role]: Math.round((ev.loaded / ev.total) * 100) }))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error('Upload to storage failed. Try again, or paste a YouTube link.'))
        }
        xhr.onerror = () => reject(new Error('Upload to storage failed. Try again, or paste a YouTube link.'))
        xhr.send(file)
      })

      const doneHeaders = await panelAuthHeaders(true)
      const doneRes = await adminFetch('/api/admin/get-started-videos/upload', {
        method: 'POST',
        headers: doneHeaders,
        body: JSON.stringify({
          action: 'complete',
          role,
          objectPath: startData.objectPath,
          fileName: file.name,
          contentType: startData.contentType || file.type,
        }),
      })
      const doneData = await doneRes.json()
      if (!doneRes.ok) throw new Error(doneData.error || 'Could not finish upload')
      setVideo(doneData.video)
      setNotice(`${GET_STARTED_ROLE_META[role].title} video uploaded`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
      setProgress(prev => ({ ...prev, [role]: 0 }))
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

      <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 900, letterSpacing: '-0.4px', margin: '0 0 8px' }}>
        Get started videos
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 24, maxWidth: 640 }}>
        Upload an MP4 (up to 200MB) or paste a YouTube / Vimeo link. Until a video is set, the public
        page keeps the “coming soon” placeholder.
      </p>

      {error && (
        <p style={{ color: '#B91C1C', background: '#FEF2F2', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </p>
      )}
      {notice && (
        <p style={{ color: '#166534', background: '#F0FDF4', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          {notice}
        </p>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-3)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {GET_STARTED_ROLES.map(role => {
            const meta = GET_STARTED_ROLE_META[role]
            const video = videos[role]
            const uploading = busy === `up-${role}`
            const pct = progress[role] || 0
            return (
              <section
                key={role}
                style={{
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: 24,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <IconBadge name={meta.icon} size={18} />
                      {meta.title}
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '6px 0 0' }}>
                      {video.url
                        ? `${videoKindLabel(video.kind)}${video.fileName ? ` · ${video.fileName}` : ''}`
                        : 'No video yet — placeholder on /get-started'}
                    </p>
                  </div>
                  {video.url && (
                    <button
                      type="button"
                      onClick={() => void remove(role)}
                      disabled={busy !== null}
                      style={{
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        borderRadius: 10,
                        padding: '8px 14px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {video.embedUrl && video.kind && (video.kind === 'youtube' || video.kind === 'vimeo') && (
                  <iframe
                    title={`${meta.title} tutorial`}
                    src={video.embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 14, marginBottom: 16 }}
                  />
                )}
                {video.url && video.kind && video.kind !== 'youtube' && video.kind !== 'vimeo' && (
                  <video
                    src={video.url}
                    controls
                    preload="metadata"
                    style={{ width: '100%', maxHeight: 360, borderRadius: 14, background: '#0f172a', marginBottom: 16 }}
                  />
                )}

                <form onSubmit={e => void saveLink(e, role)} style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Paste YouTube, Vimeo, or MP4 URL</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=…"
                      value={links[role]}
                      onChange={e => setLinks(prev => ({ ...prev, [role]: e.target.value }))}
                      style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                    />
                    <button
                      type="submit"
                      disabled={busy !== null || !links[role].trim()}
                      style={{
                        background: 'var(--primary)',
                        color: '#fff',
                        border: 0,
                        borderRadius: 12,
                        padding: '12px 18px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {busy === `link-${role}` ? 'Saving…' : 'Save link'}
                    </button>
                  </div>
                </form>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                    Or upload a file
                  </label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    disabled={busy !== null}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) void uploadFile(role, file)
                    }}
                  />
                  {uploading && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                      Uploading… {pct}%
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
