'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'

type Folder = {
  id: string
  name: string
  parentId: string | null
  createdAt: string | null
  createdByEmail: string | null
}

type FileItem = {
  id: string
  folderId: string
  name: string
  usage: string
  fileName: string
  contentType: string
  size: number
  downloadUrl: string
  createdAt: string | null
  createdByEmail: string | null
}

function formatBytes(n: number) {
  if (!n || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

export default function ImportantFilesPage() {
  const confirmDelete = useConfirmDelete()
  const [folderId, setFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Folder[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [fileName, setFileName] = useState('')
  const [usage, setUsage] = useState('')
  const [fileList, setFileList] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!folderId) {
        const res = await adminFetch('/api/admin/important-folders?parentId=', {
          cache: 'no-store',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load folders')
        setFolders(Array.isArray(data.folders) ? data.folders : [])
        setFiles([])
        setBreadcrumb([])
      } else {
        const res = await adminFetch(
          `/api/admin/important-files?folderId=${encodeURIComponent(folderId)}`,
          { cache: 'no-store' },
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load folder')
        setFolders(Array.isArray(data.folders) ? data.folders : [])
        setFiles(Array.isArray(data.files) ? data.files : [])
        setBreadcrumb(Array.isArray(data.breadcrumb) ? data.breadcrumb : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [folderId])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreateFolder(e: FormEvent) {
    e.preventDefault()
    setCreatingFolder(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/important-folders', {
        method: 'POST',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: folderId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create folder')
      setNewFolderName('')
      setNotice(`Folder “${data.folder?.name || newFolderName}” created.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (!folderId) {
      setError('Open a folder first, then upload files into it.')
      return
    }
    if (!fileList || fileList.length === 0) {
      setError('Choose at least one file to upload.')
      return
    }

    setUploading(true)
    setError('')
    setNotice('')
    try {
      let uploaded = 0
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const form = new FormData()
        form.set('folderId', folderId)
        form.set(
          'name',
          fileList.length === 1 && fileName.trim() ? fileName.trim() : file.name,
        )
        form.set('usage', usage.trim())
        form.set('file', file)
        const res = await adminFetch('/api/admin/important-files', {
          method: 'POST',
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`)
        uploaded += 1
      }
      setFileName('')
      setUsage('')
      setFileList(null)
      setNotice(
        uploaded === 1 ? 'File uploaded.' : `${uploaded} files uploaded.`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function removeFolder(folder: Folder) {
    if (
      !(await confirmDelete(
        folder.name,
        'Delete this folder? It must be empty (no files or subfolders).',
      ))
    ) {
      return
    }
    try {
      const res = await adminFetch(`/api/admin/important-folders/${folder.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Folder deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function removeFile(item: FileItem) {
    if (
      !(await confirmDelete(
        item.name,
        'Remove this file from storage? This cannot be undone.',
      ))
    ) {
      return
    }
    try {
      const res = await adminFetch(`/api/admin/important-files/${item.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('File deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const parentOfCurrent =
    breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '8px 16px 48px' }}>
      <DashboardBackLink />
      <DashboardPageHeader
        sectionId="important-files"
        description="Store important documents in folders. Add a display name, usage note, and the file."
        actions={<DashboardRefreshButton onClick={() => void load()} />}
      />

      <div style={hintBox}>
        Create folders (e.g. <strong>Development</strong>), open them, then upload
        one or more files. Each file keeps a name, usage, and downloadable link.
      </div>

      {error ? <div style={errorText}>{error}</div> : null}
      {notice ? <div style={noticeText}>{notice}</div> : null}

      <nav style={breadcrumbNav} aria-label="Folder path">
        <button type="button" style={crumbBtn} onClick={() => setFolderId(null)}>
          All folders
        </button>
        {breadcrumb.map(f => (
          <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#9CA3AF' }}>/</span>
            <button type="button" style={crumbBtn} onClick={() => setFolderId(f.id)}>
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      <form onSubmit={onCreateFolder} style={formCard}>
        <h3 style={formTitle}>
          {folderId ? 'New subfolder' : 'Create folder'}
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            required
            maxLength={80}
            placeholder="e.g. Development"
            style={{ ...inputStyle, flex: '1 1 220px' }}
          />
          <button type="submit" disabled={creatingFolder} style={primaryBtn}>
            {creatingFolder ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </form>

      {folderId ? (
        <form onSubmit={onUpload} style={formCard}>
          <h3 style={formTitle}>Upload file(s) here</h3>
          <label style={labelStyle}>
            Display name (optional for multi-file)
            <input
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              maxLength={120}
              placeholder="Defaults to the uploaded file name"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Usage
            <input
              value={usage}
              onChange={e => setUsage(e.target.value)}
              maxLength={200}
              placeholder="What this file is for"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            File(s)
            <input
              type="file"
              multiple
              onChange={e => setFileList(e.target.files)}
              style={{ ...inputStyle, padding: 10 }}
            />
          </label>
          <button type="submit" disabled={uploading} style={primaryBtn}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      ) : (
        <div style={{ ...formCard, color: '#6B7280', fontSize: 14 }}>
          Open a folder to upload files into it.
        </div>
      )}

      {folderId ? (
        <button
          type="button"
          onClick={() => setFolderId(parentOfCurrent)}
          style={{ ...ghostBtn, marginTop: 16 }}
        >
          ← Up one level
        </button>
      ) : null}

      <h2 style={{ marginTop: 28, fontSize: 17, fontWeight: 900 }}>
        {folderId ? 'Folders & files' : 'Folders'}
      </h2>

      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {folders.length === 0 && files.length === 0 ? (
            <p style={{ color: '#6B7280' }}>
              {folderId ? 'This folder is empty.' : 'No folders yet — create one above.'}
            </p>
          ) : null}

          {folders.map(folder => (
            <article key={folder.id} style={itemCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setFolderId(folder.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{folder.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6B7280' }}>
                    Folder
                    {folder.createdByEmail ? ` · ${folder.createdByEmail}` : ''}
                  </div>
                </button>
                <button type="button" onClick={() => void removeFolder(folder)} style={dangerBtn}>
                  Delete
                </button>
              </div>
            </article>
          ))}

          {files.map(item => (
            <article key={item.id} style={itemCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>{item.name}</div>
                  {item.usage ? (
                    <div style={{ marginTop: 4, color: '#4B5563', fontSize: 13.5 }}>
                      Usage: {item.usage}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
                    {item.fileName} · {formatBytes(item.size)}
                    {item.createdAt ? ` · ${formatWhen(item.createdAt)}` : ''}
                    {item.createdByEmail ? ` · ${item.createdByEmail}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                  <a
                    href={item.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}
                  >
                    View / Download
                  </a>
                  <button type="button" onClick={() => void removeFile(item)} style={dangerBtn}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

const hintBox: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
  color: '#9A3412',
  fontSize: 13.5,
  fontWeight: 600,
  lineHeight: 1.4,
}

const errorText: CSSProperties = {
  marginTop: 12,
  color: '#B91C1C',
  fontWeight: 700,
}

const noticeText: CSSProperties = {
  marginTop: 12,
  color: '#047857',
  fontWeight: 700,
}

const breadcrumbNav: CSSProperties = {
  marginTop: 16,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 700,
}

const crumbBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#EA580C',
  fontWeight: 800,
  cursor: 'pointer',
  padding: '2px 4px',
  fontFamily: 'inherit',
}

const formCard: CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 18,
  background: '#fff',
  border: '1px solid #E5E7EB',
  display: 'grid',
  gap: 12,
}

const formTitle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid #D1D5DB',
  padding: '11px 12px',
  fontSize: 14,
  background: '#F9FAFB',
  fontFamily: 'inherit',
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '13px 16px',
  background: '#FF8A00',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const ghostBtn: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: '8px 10px',
  background: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#111827',
  fontSize: 13,
}

const dangerBtn: CSSProperties = {
  ...ghostBtn,
  color: '#BE123C',
  borderColor: '#FECDD3',
}

const itemCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  padding: 14,
}
