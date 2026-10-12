/**
 * Hide Malawi phone numbers in seller text.
 * 0992434302 and +265 99 243 4302 become 099*******.
 */
const CANDIDATE = /(?:\+\s*)?\d(?:[\d\s().-]{6,18})\d/g

function localMalawiMobile(digits: string): string | null {
  let local = digits
  if (local.startsWith('265')) local = local.slice(3)
  if (local.length === 9 && /^[89]/.test(local)) local = `0${local}`
  if (local.length === 10 && /^0[89]/.test(local)) return local
  return null
}

export function maskPhoneNumbers(text: string): string {
  if (!text) return text
  return text.replace(CANDIDATE, raw => {
    const digits = raw.replace(/\D/g, '')
    const local = localMalawiMobile(digits)
    if (!local) return raw
    return `${local.slice(0, 3)}${'*'.repeat(local.length - 3)}`
  })
}
