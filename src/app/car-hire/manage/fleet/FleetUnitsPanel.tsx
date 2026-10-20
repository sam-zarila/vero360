'use client'

import { useState } from 'react'
import { carTitle, type OwnerVehicle } from '@/lib/car-hire'
import {
  addListingUnits,
  groupListingUnits,
  ProviderApiError,
  ungroupListingUnit,
} from '@/lib/car-hire-owner-api'
import { ghostButton, inputStyle, labelStyle, primaryButton } from '../components/ProviderUI'

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ProviderApiError && err.status === 403) {
    return 'Your membership does not include fleet management.'
  }
  return err instanceof Error ? err.message : fallback
}

/**
 * Units of one listing. Identical cars share the listing's price, photos and
 * rules; each unit keeps its own registration, availability and date blocks.
 */
export default function FleetUnitsPanel({
  primary,
  units,
  mergeCandidates,
  onChanged,
  onEditUnit,
  onBlockUnit,
}: {
  primary: OwnerVehicle
  units: OwnerVehicle[]
  mergeCandidates: OwnerVehicle[]
  onChanged: (message: string) => void
  onEditUnit: (car: OwnerVehicle) => void
  onBlockUnit: (car: OwnerVehicle) => void
}) {
  const [plates, setPlates] = useState('')
  const [mergeId, setMergeId] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key)
    setError('')
    try {
      onChanged(await action())
    } catch (err) {
      setError(errorText(err, 'The fleet change could not be saved.'))
    } finally {
      setBusy('')
    }
  }

  function addUnits() {
    const list = plates
      .split(/[\n,]+/)
      .map(plate => plate.trim())
      .filter(Boolean)
    if (list.length === 0) {
      setError('Enter at least one registration plate.')
      return
    }
    void run('add', async () => {
      const result = await addListingUnits(
        primary.id,
        list.map(licensePlate => ({ licensePlate })),
      )
      setPlates('')
      return `${result.created.length} unit${result.created.length === 1 ? '' : 's'} added to ${carTitle(primary)}.`
    })
  }

  function merge() {
    const id = Number(mergeId)
    if (!id) return
    void run('merge', async () => {
      await groupListingUnits([primary.id, id])
      setMergeId('')
      return `Merged into ${carTitle(primary)}. The merged car now uses this listing's price, photos and rules.`
    })
  }

  return (
    <div style={panel}>
      <p style={heading}>
        {units.length} unit{units.length === 1 ? '' : 's'} on this listing
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {units.map(unit => (
          <div key={unit.id} style={row}>
            <div style={{ minWidth: 0 }}>
              <p style={plate}>{unit.licensePlate || `Car #${unit.id}`}</p>
              <p style={meta}>
                {[unit.unitLabel, unit.color, unit.isAvailable === false ? 'Out of service' : 'In service']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button type="button" style={smallButton} onClick={() => onEditUnit(unit)}>
                Edit
              </button>
              <button type="button" style={smallButton} onClick={() => onBlockUnit(unit)}>
                Block
              </button>
              {units.length > 1 ? (
                <button
                  type="button"
                  style={smallButton}
                  disabled={busy !== ''}
                  onClick={() =>
                    void run(`split-${unit.id}`, async () => {
                      await ungroupListingUnit(unit.id)
                      return `${unit.licensePlate || 'Unit'} is now its own listing.`
                    })
                  }
                >
                  Split
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor={`plates-${primary.id}`} style={labelStyle}>
          Add identical units (one plate per line)
        </label>
        <textarea
          id={`plates-${primary.id}`}
          value={plates}
          onChange={event => setPlates(event.target.value)}
          rows={2}
          placeholder={'BZ 1234\nBZ 5678'}
          disabled={busy !== ''}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 54 }}
        />
        <button
          type="button"
          onClick={addUnits}
          disabled={busy !== ''}
          style={{ ...primaryButton, marginTop: 6 }}
        >
          {busy === 'add' ? 'Adding…' : 'Add units'}
        </button>
      </div>

      {mergeCandidates.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <label htmlFor={`merge-${primary.id}`} style={labelStyle}>
            Merge an identical car listed separately
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select
              id={`merge-${primary.id}`}
              value={mergeId}
              onChange={event => setMergeId(event.target.value)}
              disabled={busy !== ''}
              style={{ ...inputStyle, flex: '1 1 160px' }}
            >
              <option value="">Choose a car…</option>
              {mergeCandidates.map(car => (
                <option key={car.id} value={car.id}>
                  {carTitle(car)} · {car.licensePlate || `#${car.id}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={merge}
              disabled={busy !== '' || !mergeId}
              style={ghostButton}
            >
              {busy === 'merge' ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ ...meta, color: '#B91C1C', fontWeight: 700, marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

const panel = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const

const heading = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 900,
  color: 'var(--text-2)',
} as const

const row = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '7px 9px',
  borderRadius: 9,
  background: 'var(--bg, #fff)',
  border: '1px solid var(--border)',
} as const

const plate = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.3,
} as const

const meta = {
  margin: '2px 0 0',
  fontSize: 11,
  color: 'var(--text-3)',
} as const

const smallButton = {
  ...ghostButton,
  padding: '5px 9px',
  fontSize: 11,
} as const
