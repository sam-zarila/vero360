'use client'

import {
  MALAWI_DISTRICTS,
  VERO_ALWAYS_ON,
  type ListingPolicies,
  type RentalMode,
  type TravelAreaMode,
} from '@/lib/car-hire-policy'
import { inputStyle, labelStyle } from './ProviderUI'

export default function ListingPoliciesEditor({
  value,
  onChange,
  disabled,
}: {
  value: ListingPolicies
  onChange: (next: ListingPolicies) => void
  disabled?: boolean
}) {
  const set = (patch: Partial<ListingPolicies>) => onChange({ ...value, ...patch })
  const toggleMode = (mode: RentalMode) => {
    const has = value.rentalModes.includes(mode)
    const next = has
      ? value.rentalModes.filter(item => item !== mode)
      : [...value.rentalModes, mode]
    set({ rentalModes: next.length ? next : [mode] })
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section>
        <h4 style={heading}>Always applied by Vero360</h4>
        <ul style={list}>
          {VERO_ALWAYS_ON.map(rule => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      <section>
        <h4 style={heading}>Your listing rules</h4>
        <p style={hint}>
          Tick only what this listing permits. Unticked items stay prohibited, as in the
          Vero360 Car Hire Service Policy.
        </p>
        <div style={grid}>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.rentalModes.includes('SELF_DRIVE')}
              onChange={() => toggleMode('SELF_DRIVE')}
              disabled={disabled}
            />
            Self-drive
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.rentalModes.includes('WITH_DRIVER')}
              onChange={() => toggleMode('WITH_DRIVER')}
              disabled={disabled}
            />
            With driver
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.extraDriversAllowed}
              onChange={event => set({ extraDriversAllowed: event.target.checked })}
              disabled={disabled || !value.rentalModes.includes('SELF_DRIVE')}
            />
            Extra drivers (self-drive)
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.smokingAllowed}
              onChange={event => set({ smokingAllowed: event.target.checked })}
              disabled={disabled}
            />
            Smoking allowed
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.petsAllowed}
              onChange={event => set({ petsAllowed: event.target.checked })}
              disabled={disabled}
            />
            Pets allowed
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.crossBorderAllowed}
              onChange={event => set({ crossBorderAllowed: event.target.checked })}
              disabled={disabled}
            />
            Cross-border travel
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.offRoadAllowed}
              onChange={event => set({ offRoadAllowed: event.target.checked })}
              disabled={disabled}
            />
            Off-road use
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.deliveryOffered}
              onChange={event => set({ deliveryOffered: event.target.checked })}
              disabled={disabled}
            />
            Delivery / collection
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.immobilizeAvailable}
              onChange={event => set({ immobilizeAvailable: event.target.checked })}
              disabled={disabled}
            />
            Remote engine-off available
          </label>
        </div>
        {value.extraDriversAllowed ? (
          <label style={{ display: 'grid', gap: 4, marginTop: 10 }}>
            <span style={labelStyle}>Maximum extra drivers</span>
            <input
              type="number"
              min={1}
              max={5}
              value={value.extraDriversMax || 1}
              onChange={event => set({ extraDriversMax: Number(event.target.value) || 1 })}
              disabled={disabled}
              style={inputStyle}
            />
          </label>
        ) : null}
        <div style={{ ...grid, marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelStyle}>Travel area</span>
            <select
              value={value.travelAreaMode}
              onChange={event => set({ travelAreaMode: event.target.value as TravelAreaMode })}
              disabled={disabled}
              style={inputStyle}
            >
              <option value="NATIONWIDE">Nationwide Malawi</option>
              <option value="HIRE_AREA">Hire area only</option>
              <option value="DISTRICT">Selected district(s)</option>
            </select>
          </label>
          <label style={choice}>
            <input
              type="checkbox"
              checked={value.geofenceAlerts}
              onChange={event => set({ geofenceAlerts: event.target.checked })}
              disabled={disabled || value.travelAreaMode !== 'NATIONWIDE'}
            />
            GPS alerts if the car leaves the allowed area
          </label>
          {value.travelAreaMode === 'HIRE_AREA' ? (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelStyle}>Hire-area radius (km)</span>
              <input
                type="number"
                min={5}
                max={150}
                value={value.hireAreaRadiusKm}
                onChange={event => set({ hireAreaRadiusKm: Number(event.target.value) || 25 })}
                disabled={disabled}
                style={inputStyle}
              />
            </label>
          ) : null}
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelStyle}>Fuel return</span>
            <select
              value={value.fuelPolicy}
              onChange={event =>
                set({
                  fuelPolicy: event.target.value === 'LISTING_STATED' ? 'LISTING_STATED' : 'SAME_LEVEL',
                })
              }
              disabled={disabled}
              style={inputStyle}
            >
              <option value="SAME_LEVEL">Same level as handover</option>
              <option value="LISTING_STATED">As stated on the listing</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelStyle}>Daily mileage allowance (km)</span>
            <input
              type="number"
              min={0}
              value={value.mileageAllowanceKm ?? ''}
              onChange={event =>
                set({
                  mileageAllowanceKm: event.target.value === '' ? null : Number(event.target.value),
                })
              }
              disabled={disabled}
              style={inputStyle}
              placeholder="No limit stated"
            />
          </label>
        </div>
        {value.travelAreaMode === 'DISTRICT' ? (
          <div style={{ marginTop: 12 }}>
            <span style={labelStyle}>Allowed districts</span>
            <div style={{ ...grid, marginTop: 6 }}>
              {MALAWI_DISTRICTS.map(district => (
                <label key={district.id} style={choice}>
                  <input
                    type="checkbox"
                    checked={value.allowedDistricts.includes(district.id)}
                    onChange={event => {
                      const next = event.target.checked
                        ? [...value.allowedDistricts, district.id]
                        : value.allowedDistricts.filter(id => id !== district.id)
                      set({ allowedDistricts: next })
                    }}
                    disabled={disabled}
                  />
                  {district.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <label style={{ display: 'grid', gap: 4, marginTop: 12 }}>
          <span style={labelStyle}>House notes (not legal terms)</span>
          <textarea
            value={value.houseNotes}
            onChange={event => set({ houseNotes: event.target.value })}
            maxLength={400}
            rows={3}
            disabled={disabled}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Pickup instructions or local tips. These cannot override Vero rules."
          />
        </label>
        {value.crossBorderAllowed || value.immobilizeAvailable ? (
          <p style={{ ...hint, marginTop: 10 }}>
            Cross-border still needs documents and insurance. Engine-off is a gated action on an
            active trip after a confirmed breach, theft or safety incident — it does not fire
            automatically.
          </p>
        ) : null}
      </section>
    </div>
  )
}

const heading = { margin: 0, fontSize: 14, fontWeight: 800 } as const
const hint = { margin: '4px 0 8px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' } as const
const list = { margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.55, color: 'var(--text-2)' } as const
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 } as const
const choice = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text)' } as const
