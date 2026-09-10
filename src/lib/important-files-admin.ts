import 'server-only'

import { randomUUID } from 'crypto'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'

export const IMPORTANT_FOLDERS_COLLECTION = 'important_folders'
export const IMPORTANT_FILES_COLLECTION = 'important_files'

const MAX_FILE_BYTES = 40 * 1024 * 1024

export type ImportantFolder = {
  id: string
  name: string
  parentId: string | null
  createdAt: string | null
  updatedAt: string | null
  createdByEmail: string | null
}

export type ImportantFile = {
  id: string
  folderId: string
  name: string
  usage: string
  fileName: string
  contentType: string
  size: number
  storagePath: string
  downloadUrl: string
  createdAt: string | null
  updatedAt: string | null
  createdByEmail: string | null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

function firebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

function safeFileName(name: string): string {
  const base = str(name).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 180)
  return base || 'file'
}

function extFromName(fileName: string): string {
  const parts = fileName.split('.')
  if (parts.length < 2) return ''
  const ext = parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext.slice(0, 12)
}

export function parseImportantFolder(
  id: string,
  data: DocumentData | Record<string, unknown>,
): ImportantFolder {
  return {
    id,
    name: str(data.name) || 'Untitled folder',
    parentId: str(data.parentId) || null,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdByEmail: str(data.createdByEmail) || null,
  }
}

export function parseImportantFile(
  id: string,
  data: DocumentData | Record<string, unknown>,
): ImportantFile {
  return {
    id,
    folderId: str(data.folderId),
    name: str(data.name) || str(data.fileName) || 'Untitled file',
    usage: str(data.usage),
    fileName: str(data.fileName) || str(data.name) || 'file',
    contentType: str(data.contentType) || 'application/octet-stream',
    size: typeof data.size === 'number' ? data.size : Number(data.size) || 0,
    storagePath: str(data.storagePath),
    downloadUrl: str(data.downloadUrl),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdByEmail: str(data.createdByEmail) || null,
  }
}

export async function listImportantFolders(parentId?: string | null): Promise<ImportantFolder[]> {
  const parent = parentId === undefined ? undefined : parentId || null
  let snap
  try {
    let q = getAdminDb().collection(IMPORTANT_FOLDERS_COLLECTION).orderBy('name', 'asc')
    if (parent !== undefined) {
      q = getAdminDb()
        .collection(IMPORTANT_FOLDERS_COLLECTION)
        .where('parentId', '==', parent)
        .orderBy('name', 'asc') as typeof q
    }
    snap = await q.limit(200).get()
  } catch {
    snap = await getAdminDb().collection(IMPORTANT_FOLDERS_COLLECTION).limit(200).get()
  }

  let items = snap.docs.map(d => parseImportantFolder(d.id, d.data() || {}))
  if (parent !== undefined) {
    items = items.filter(f => (f.parentId || null) === parent)
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export async function getImportantFolder(id: string): Promise<ImportantFolder | null> {
  const doc = await getAdminDb().collection(IMPORTANT_FOLDERS_COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return parseImportantFolder(doc.id, doc.data() || {})
}

export async function createImportantFolder(input: {
  name: string
  parentId?: string | null
  createdByEmail?: string
}): Promise<ImportantFolder> {
  const name = str(input.name)
  if (!name) throw new Error('Folder name is required')

  const parentId = str(input.parentId) || null
  if (parentId) {
    const parent = await getImportantFolder(parentId)
    if (!parent) throw new Error('Parent folder not found')
  }

  const ref = getAdminDb().collection(IMPORTANT_FOLDERS_COLLECTION).doc()
  const payload = {
    name,
    parentId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByEmail: str(input.createdByEmail) || null,
  }
  await ref.set(payload)
  const snap = await ref.get()
  return parseImportantFolder(ref.id, snap.data() || { name, parentId })
}

export async function renameImportantFolder(
  id: string,
  name: string,
): Promise<ImportantFolder> {
  const next = str(name)
  if (!next) throw new Error('Folder name is required')
  const ref = getAdminDb().collection(IMPORTANT_FOLDERS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Folder not found')
  await ref.set({ name: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  const fresh = await ref.get()
  return parseImportantFolder(id, fresh.data() || {})
}

export async function deleteImportantFolder(id: string): Promise<void> {
  const folder = await getImportantFolder(id)
  if (!folder) throw Object.assign(new Error('Folder not found'), { status: 404 })

  const childFolders = await listImportantFolders(id)
  if (childFolders.length > 0) {
    throw new Error('Folder is not empty — delete subfolders first')
  }

  const files = await listImportantFiles(id)
  if (files.length > 0) {
    throw new Error('Folder is not empty — delete files first')
  }

  await getAdminDb().collection(IMPORTANT_FOLDERS_COLLECTION).doc(id).delete()
}

export async function listImportantFiles(folderId: string): Promise<ImportantFile[]> {
  const id = str(folderId)
  if (!id) throw new Error('folderId is required')

  let snap
  try {
    snap = await getAdminDb()
      .collection(IMPORTANT_FILES_COLLECTION)
      .where('folderId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get()
  } catch {
    snap = await getAdminDb()
      .collection(IMPORTANT_FILES_COLLECTION)
      .where('folderId', '==', id)
      .limit(300)
      .get()
  }

  const items = snap.docs.map(d => parseImportantFile(d.id, d.data() || {}))
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return items
}

export async function getImportantFile(id: string): Promise<ImportantFile | null> {
  const doc = await getAdminDb().collection(IMPORTANT_FILES_COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return parseImportantFile(doc.id, doc.data() || {})
}

export async function uploadImportantFileBytes(input: {
  folderId: string
  file: File
}): Promise<{
  storagePath: string
  downloadUrl: string
  contentType: string
  size: number
  originalName: string
}> {
  const folderId = str(input.folderId)
  if (!folderId) throw new Error('folderId is required')
  const folder = await getImportantFolder(folderId)
  if (!folder) throw new Error('Folder not found')

  const file = input.file
  if (!(file instanceof File) || file.size <= 0) throw new Error('A file is required')
  if (file.size > MAX_FILE_BYTES) throw new Error('File must be 40MB or smaller')

  const originalName = safeFileName(file.name || 'file')
  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  const ext = extFromName(originalName)
  const objectPath = `important_files/${folderId}/${Date.now()}-${randomUUID().slice(0, 8)}${ext ? `.${ext}` : ''}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const token = randomUUID()

  await bucket.file(objectPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalName,
        folderId,
      },
    },
  })

  return {
    storagePath: objectPath,
    downloadUrl: firebaseDownloadUrl(bucket.name, objectPath, token),
    contentType,
    size: file.size,
    originalName,
  }
}

export async function createImportantFile(input: {
  folderId: string
  name: string
  usage?: string
  file: File
  createdByEmail?: string
}): Promise<ImportantFile> {
  const folderId = str(input.folderId)
  const name = str(input.name)
  if (!folderId) throw new Error('folderId is required')
  if (!name) throw new Error('File name is required')

  const uploaded = await uploadImportantFileBytes({
    folderId,
    file: input.file,
  })

  const ref = getAdminDb().collection(IMPORTANT_FILES_COLLECTION).doc()
  const payload = {
    folderId,
    name,
    usage: str(input.usage),
    fileName: uploaded.originalName,
    contentType: uploaded.contentType,
    size: uploaded.size,
    storagePath: uploaded.storagePath,
    downloadUrl: uploaded.downloadUrl,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByEmail: str(input.createdByEmail) || null,
  }
  await ref.set(payload)
  const snap = await ref.get()
  return parseImportantFile(ref.id, snap.data() || payload)
}

export async function updateImportantFile(
  id: string,
  patch: Partial<{ name: string; usage: string }>,
): Promise<ImportantFile> {
  const ref = getAdminDb().collection(IMPORTANT_FILES_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('File not found')

  const next: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (patch.name !== undefined) {
    const name = str(patch.name)
    if (!name) throw new Error('File name is required')
    next.name = name
  }
  if (patch.usage !== undefined) next.usage = str(patch.usage)

  await ref.set(next, { merge: true })
  const fresh = await ref.get()
  return parseImportantFile(id, fresh.data() || {})
}

export async function deleteImportantFile(id: string): Promise<void> {
  const existing = await getImportantFile(id)
  if (!existing) throw Object.assign(new Error('File not found'), { status: 404 })

  if (existing.storagePath) {
    try {
      await getAdminStorage()
        .bucket(getAdminStorageBucket())
        .file(existing.storagePath)
        .delete({ ignoreNotFound: true })
    } catch (err) {
      console.warn('deleteImportantFile storage cleanup:', err)
    }
  }

  await getAdminDb().collection(IMPORTANT_FILES_COLLECTION).doc(id).delete()
}

export async function buildFolderBreadcrumb(folderId: string | null): Promise<ImportantFolder[]> {
  if (!folderId) return []
  const chain: ImportantFolder[] = []
  let currentId: string | null = folderId
  const seen = new Set<string>()
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    const folder = await getImportantFolder(currentId)
    if (!folder) break
    chain.unshift(folder)
    currentId = folder.parentId
  }
  return chain
}
