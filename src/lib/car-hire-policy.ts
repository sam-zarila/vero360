export const CAR_HIRE_POLICY_VERSION = '1.0'
export const CAR_HIRE_POLICY_PDF = '/legal/Vero360_Car_Hire_Service_Policy.pdf'

export type RentalMode = 'SELF_DRIVE' | 'WITH_DRIVER'
export type TravelAreaMode = 'HIRE_AREA' | 'DISTRICT' | 'NATIONWIDE'
export type FuelPolicy = 'SAME_LEVEL' | 'LISTING_STATED'

export type PolicyChip = {
  id: string
  label: string
  allowed: boolean | null
  value?: string | null
}

export type ListingPolicies = {
  rentalModes: RentalMode[]
  extraDriversAllowed: boolean
  extraDriversMax: number
  smokingAllowed: boolean
  petsAllowed: boolean
  crossBorderAllowed: boolean
  offRoadAllowed: boolean
  mileageAllowanceKm: number | null
  extraKmRate: number | null
  fuelPolicy: FuelPolicy
  deliveryOffered: boolean
  travelAreaMode: TravelAreaMode
  hireAreaRadiusKm: number
  allowedDistricts: string[]
  geofenceAlerts: boolean
  immobilizeAvailable: boolean
  houseNotes: string
  chips: PolicyChip[]
}

export type PolicyKeyPoint = { topic: string; summary: string }

export const MALAWI_DISTRICTS = [
  { id: 'chitipa', name: 'Chitipa', region: 'Northern' },
  { id: 'karonga', name: 'Karonga', region: 'Northern' },
  { id: 'rumphi', name: 'Rumphi', region: 'Northern' },
  { id: 'mzimba', name: 'Mzimba', region: 'Northern' },
  { id: 'nkhata-bay', name: 'Nkhata Bay', region: 'Northern' },
  { id: 'likoma', name: 'Likoma', region: 'Northern' },
  { id: 'kasungu', name: 'Kasungu', region: 'Central' },
  { id: 'nkhotakota', name: 'Nkhotakota', region: 'Central' },
  { id: 'ntchisi', name: 'Ntchisi', region: 'Central' },
  { id: 'dowa', name: 'Dowa', region: 'Central' },
  { id: 'salima', name: 'Salima', region: 'Central' },
  { id: 'lilongwe', name: 'Lilongwe', region: 'Central' },
  { id: 'mchinji', name: 'Mchinji', region: 'Central' },
  { id: 'dedza', name: 'Dedza', region: 'Central' },
  { id: 'ntcheu', name: 'Ntcheu', region: 'Central' },
  { id: 'mangochi', name: 'Mangochi', region: 'Southern' },
  { id: 'machinga', name: 'Machinga', region: 'Southern' },
  { id: 'zomba', name: 'Zomba', region: 'Southern' },
  { id: 'chiradzulu', name: 'Chiradzulu', region: 'Southern' },
  { id: 'blantyre', name: 'Blantyre', region: 'Southern' },
  { id: 'mwanza', name: 'Mwanza', region: 'Southern' },
  { id: 'thyolo', name: 'Thyolo', region: 'Southern' },
  { id: 'mulanje', name: 'Mulanje', region: 'Southern' },
  { id: 'phalombe', name: 'Phalombe', region: 'Southern' },
  { id: 'chikwawa', name: 'Chikwawa', region: 'Southern' },
  { id: 'nsanje', name: 'Nsanje', region: 'Southern' },
  { id: 'balaka', name: 'Balaka', region: 'Southern' },
  { id: 'neno', name: 'Neno', region: 'Southern' },
] as const

export const CAR_HIRE_POLICY_KEY_POINTS: PolicyKeyPoint[] = [
  { topic: 'Role of Vero360', summary: 'Facilitator only. No vehicles are owned, insured or operated by Vero360.' },
  { topic: 'Who can book', summary: 'Verified Renters. Self-drive requires a valid driving licence for the class of vehicle.' },
  { topic: 'Payment', summary: 'In-app only, through PawaPay. Payments outside the App are not protected.' },
  { topic: 'Security deposit', summary: 'Held by Vero360 and returned after the trip unless a substantiated claim is lodged.' },
  { topic: 'Handover and return', summary: 'Photo Condition Report on both occasions, and GPS-tied trip start.' },
]

export const VERO_ALWAYS_ON = [
  'In-app payment only through PawaPay. Off-app payments are not protected.',
  'Security deposit is held by Vero360 and returned after the trip unless a claim is lodged.',
  'Cancellation: 48h+ full refund; 24–48h 50%; under 24h or no-show no rental refund. Deposit always refunded on cancel.',
  '60-minute grace, then 1.5× the hourly rate for late return.',
  'Photo Condition Report and GPS-tied trip start are required.',
  'No off-platform deals. Do not tamper with tracking.',
]

export const DEFAULT_LISTING_POLICIES: ListingPolicies = {
  rentalModes: ['SELF_DRIVE'],
  extraDriversAllowed: false,
  extraDriversMax: 0,
  smokingAllowed: false,
  petsAllowed: false,
  crossBorderAllowed: false,
  offRoadAllowed: false,
  mileageAllowanceKm: null,
  extraKmRate: null,
  fuelPolicy: 'SAME_LEVEL',
  deliveryOffered: false,
  travelAreaMode: 'NATIONWIDE',
  hireAreaRadiusKm: 25,
  allowedDistricts: [],
  geofenceAlerts: true,
  immobilizeAvailable: false,
  houseNotes: '',
  chips: [],
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function parseListingPolicies(value: unknown): ListingPolicies {
  const row = asRecord(value) ?? {}
  const modes = (Array.isArray(row.rentalModes) ? row.rentalModes : DEFAULT_LISTING_POLICIES.rentalModes)
    .map(item => String(item).toUpperCase())
    .filter((item): item is RentalMode => item === 'SELF_DRIVE' || item === 'WITH_DRIVER')
  const travel = String(row.travelAreaMode || 'NATIONWIDE').toUpperCase() as TravelAreaMode
  const chips: PolicyChip[] = Array.isArray(row.chips)
    ? row.chips
        .map(item => {
          const chip = asRecord(item)
          if (!chip) return null
          const parsed: PolicyChip = {
            id: String(chip.id || ''),
            label: String(chip.label || ''),
            allowed: typeof chip.allowed === 'boolean' ? chip.allowed : null,
          }
          if (chip.value != null) parsed.value = String(chip.value)
          return parsed
        })
        .filter((item): item is PolicyChip => !!item && !!item.label)
    : []
  return {
    rentalModes: modes.length ? Array.from(new Set(modes)) : ['SELF_DRIVE'],
    extraDriversAllowed: asBool(row.extraDriversAllowed, false),
    extraDriversMax: asNum(row.extraDriversMax) ?? 0,
    smokingAllowed: asBool(row.smokingAllowed, false),
    petsAllowed: asBool(row.petsAllowed, false),
    crossBorderAllowed: asBool(row.crossBorderAllowed, false),
    offRoadAllowed: asBool(row.offRoadAllowed, false),
    mileageAllowanceKm: asNum(row.mileageAllowanceKm),
    extraKmRate: asNum(row.extraKmRate),
    fuelPolicy: String(row.fuelPolicy || 'SAME_LEVEL').toUpperCase() === 'LISTING_STATED'
      ? 'LISTING_STATED'
      : 'SAME_LEVEL',
    deliveryOffered: asBool(row.deliveryOffered, false),
    travelAreaMode: ['HIRE_AREA', 'DISTRICT', 'NATIONWIDE'].includes(travel)
      ? travel
      : 'NATIONWIDE',
    hireAreaRadiusKm: asNum(row.hireAreaRadiusKm) ?? 25,
    allowedDistricts: Array.isArray(row.allowedDistricts)
      ? row.allowedDistricts.map(item => String(item))
      : [],
    geofenceAlerts: asBool(row.geofenceAlerts, true),
    immobilizeAvailable: asBool(row.immobilizeAvailable, false),
    houseNotes: String(row.houseNotes || ''),
    chips,
  }
}

export function listingPoliciesPayload(policies: ListingPolicies): Record<string, unknown> {
  const { chips: _chips, ...rest } = policies
  return rest
}
