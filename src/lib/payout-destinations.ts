/** Malawi payout destinations — same UUIDs as the merchant wallet. */

export const MIN_PAYOUT_MWK = 1000

export const PAYOUT_BANKS = [
  { uuid: '82310dd1-ec9b-4fe7-a32c-2f262ef08681', name: 'National Bank of Malawi' },
  { uuid: '5b9f76b1-620a-4eb9-8848-43d1e3e372dd', name: 'NBS Bank Limited' },
  { uuid: '87e62436-0553-4fb5-a76d-f27d28420c5b', name: 'Ecobank Malawi Limited' },
  { uuid: 'b064172a-8a1b-4f7f-aad7-81b036c46c57', name: 'FDH Bank Limited' },
  { uuid: 'e7447c2c-c147-4907-b194-e087fe8d8585', name: 'Standard Bank Limited' },
  { uuid: '236760c9-3045-4a01-990e-497b28d115bb', name: 'Centenary Bank' },
  { uuid: '968ac588-3b1f-4d89-81ff-a3d43a599003', name: 'First Capital Limited' },
  { uuid: 'c759d7b6-ae5c-4a95-814a-79171271897a', name: 'CDH Investment Bank' },
] as const

export const PAYOUT_MOMO = [
  {
    id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb',
    name: 'Airtel Money',
  },
  {
    id: '27494cb5-ba9e-437f-a114-4e7a7686bcca',
    name: 'MPamba (TNM)',
  },
] as const

export function normalizeMalawiMobile(raw: string): string {
  let mobile = raw.trim().replace(/\s+/g, '')
  if (mobile.startsWith('+265')) mobile = `0${mobile.slice(4)}`
  else if (mobile.startsWith('265')) mobile = `0${mobile.slice(3)}`
  return mobile
}
