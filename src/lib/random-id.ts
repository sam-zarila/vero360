/**
 * UUID v4 that also works outside a secure context.
 *
 * `crypto.randomUUID()` only exists on HTTPS (or localhost). A pm2/nginx
 * deployment served over plain HTTP — for example while testing by IP address —
 * throws `TypeError: crypto.randomUUID is not a function`, which used to take
 * the whole page down because the chat widget calls this during mount.
 * `crypto.getRandomValues` is available in every context, so use it instead and
 * keep a `Math.random` fallback for very old browsers.
 */
export function randomId(): string {
  const bytes = new Uint8Array(16)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  // RFC 4122 version 4 / variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/** Storage can throw (private mode, disabled cookies); never bubble that up. */
export function safeGetItem(storage: Storage | undefined, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null
  } catch {
    return null
  }
}

export function safeSetItem(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Ignore quota / disabled-storage errors.
  }
}
