import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getBankTransferConfig } from '@/lib/bank-transfer-config'
import { DIGITAL_SERVICE_ORDERS_COLLECTION } from '@/lib/digital-services'
import { getAdminDb } from '@/lib/firebase-admin'
import { formatMwk } from '@/lib/vero-api'

export type DigitalOrderEmailFields = {
  orderId: string
  to: string
  buyerName: string
  buyerPhone: string
  productName: string
  productSubtitle?: string
  amountMwk: number
  selectedUsd: number | null
  txRef: string
  paymentProvider: string
  isBank: boolean
  periodLabel?: string
}

function paymentMethodLabel(provider: string, isBank: boolean): string {
  if (isBank || provider === 'bank_transfer') return 'Bank transfer'
  if (provider === 'pawapay') return 'Mobile money (Airtel Money / TNM Mpamba)'
  return provider || 'Mobile money'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function amountLabel(amountMwk: number, selectedUsd: number | null): string {
  if (selectedUsd && selectedUsd > 0) {
    return `${formatMwk(amountMwk)} (USD ${selectedUsd})`
  }
  return formatMwk(amountMwk)
}

export function digitalOrderEmailFieldsFromData(
  orderId: string,
  data: Record<string, unknown>,
): DigitalOrderEmailFields | null {
  const to = String(data.buyerEmail || '').trim().toLowerCase()
  if (!to) return null
  const provider = String(data.paymentProvider || 'pawapay')
  return {
    orderId,
    to,
    buyerName: String(data.buyerName || '').trim(),
    buyerPhone: String(data.buyerPhone || '').trim(),
    productName: String(data.productName || 'Digital service').trim() || 'Digital service',
    productSubtitle: String(data.productSubtitle || '').trim(),
    amountMwk: Number(data.amountMwk) || 0,
    selectedUsd:
      data.selectedUsd == null || data.selectedUsd === ''
        ? null
        : Number(data.selectedUsd),
    txRef: String(data.txRef || '').trim(),
    paymentProvider: provider,
    isBank: provider === 'bank_transfer',
    periodLabel: String(data.periodLabel || '').trim(),
  }
}

async function sendDigitalBuyerEmail(opts: {
  to: string
  subject: string
  heading: string
  intro: string
  nextStep: string
  fields: DigitalOrderEmailFields
  extraLines?: string[]
}): Promise<boolean> {
  const to = opts.to.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('Digital order email skipped: RESEND_API_KEY is not set')
    return false
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>'
  const support = process.env.CONTACT_TO_EMAIL || 'info@vero360.app'
  const name = opts.fields.buyerName.trim() || 'there'
  const method = paymentMethodLabel(opts.fields.paymentProvider, opts.fields.isBank)
  const amount = amountLabel(opts.fields.amountMwk, opts.fields.selectedUsd)
  const when = new Date().toLocaleString('en-MW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const extra = (opts.extraLines || []).filter(Boolean)
  const lines = [
    `Hi ${name},`,
    '',
    opts.intro,
    '',
    'Order details',
    `Confirmed: ${when}`,
    `Product: ${opts.fields.productName}${
      opts.fields.productSubtitle ? ` — ${opts.fields.productSubtitle}` : ''
    }`,
    ...(opts.fields.periodLabel ? [`Plan: ${opts.fields.periodLabel}`] : []),
    `Amount: ${amount}`,
    `Payment method: ${method}`,
    `Payment reference: ${opts.fields.txRef || '—'}`,
    `Order ID: ${opts.fields.orderId}`,
    `Name: ${opts.fields.buyerName || '—'}`,
    `Email: ${to}`,
    `Phone: ${opts.fields.buyerPhone || '—'}`,
    '',
    ...(extra.length ? [...extra, ''] : []),
    opts.nextStep,
    '',
    `Questions? Reply to this email or write ${support}.`,
    '',
    '— Vero360',
  ]

  const htmlRows: [string, string][] = [
    ['Confirmed', when],
    ['Product', opts.fields.productName],
    ...(opts.fields.productSubtitle
      ? ([['Details', opts.fields.productSubtitle]] as [string, string][])
      : []),
    ...(opts.fields.periodLabel
      ? ([['Plan', opts.fields.periodLabel]] as [string, string][])
      : []),
    ['Amount', amount],
    ['Payment method', method],
    ['Payment reference', opts.fields.txRef || '—'],
    ['Order ID', opts.fields.orderId],
    ['Name', opts.fields.buyerName || '—'],
    ['Email', to],
    ['Phone', opts.fields.buyerPhone || '—'],
  ]

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:24px;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:#EA580C;">Vero360 Digital Services</p>
    <h1 style="margin:0 0 12px;font-size:22px;">${escapeHtml(opts.heading)}</h1>
    <p style="margin:0 0 16px;line-height:1.55;">Hi ${escapeHtml(name)}, ${escapeHtml(opts.intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${htmlRows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 0;color:#6B7280;width:40%;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}
    </table>
    ${
      extra.length
        ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.55;">${extra.map(escapeHtml).join('<br/>')}</p>`
        : ''
    }
    <p style="margin:16px 0 0;font-size:14px;line-height:1.55;">${escapeHtml(opts.nextStep)}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">Questions? Reply to this email or write ${escapeHtml(support)}.</p>
    <p style="margin:16px 0 0;font-weight:700;">— Vero360</p>
  </div>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: support,
      subject: opts.subject,
      text: lines.join('\n'),
      html,
    }),
  })
  if (!res.ok) {
    console.error('Digital order email error:', await res.text())
    return false
  }
  return true
}

export async function emailDigitalOrderPending(
  opts: DigitalOrderEmailFields,
): Promise<boolean> {
  let extraLines: string[] = []
  if (opts.isBank) {
    try {
      const bank = await getBankTransferConfig()
      if (bank.enabled) {
        extraLines = [
          `Bank: ${bank.bankName}`,
          `Account name: ${bank.accountName}`,
          `Account number: ${bank.accountNumber}`,
          `Branch: ${bank.branch}`,
        ]
      }
    } catch {
      // still send the order email
    }
  }

  return sendDigitalBuyerEmail({
    to: opts.to,
    fields: opts,
    extraLines,
    subject: `Payment awaiting · ${opts.productName} · Vero360`,
    heading: 'Payment awaiting',
    intro: `Payment is awaiting confirmation for your ${opts.productName} order.`,
    nextStep: opts.isBank
      ? 'We are reviewing your transfer slip. Keep this payment reference on the deposit so we can match it. You will receive another email when the order is confirmed and fulfilled.'
      : 'A prompt was sent to your Malawi mobile number. Approve it with your PIN. Payment is awaiting confirmation — you will receive another email when it clears and we start processing the order.',
  })
}

export async function emailDigitalOrderPaid(
  opts: DigitalOrderEmailFields,
): Promise<boolean> {
  return sendDigitalBuyerEmail({
    to: opts.to,
    fields: opts,
    subject: `We received your order · ${opts.productName} · Vero360`,
    heading: 'Payment received',
    intro: `We have received your payment for ${opts.productName}. Thank you.`,
    nextStep:
      'We are processing your order now. You will receive another email with your account details, joining link, or files as soon as it is ready. You do not need to send this payment again.',
  })
}

export async function sendPaidDigitalOrderEmail(
  orderId: string,
  data: Record<string, unknown>,
  txRef?: string,
): Promise<boolean> {
  if (data.paidEmailSentAt) return false
  const fields = digitalOrderEmailFieldsFromData(orderId, {
    ...data,
    txRef: txRef || data.txRef,
  })
  if (!fields) return false
  const emailed = await emailDigitalOrderPaid(fields).catch(err => {
    console.warn('Digital paid-order email:', err)
    return false
  })
  if (!emailed) return false
  await getAdminDb()
    .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
    .doc(orderId)
    .set(
      {
        paidEmailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch(() => {})
  return true
}
