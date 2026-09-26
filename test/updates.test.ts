import { describe, expect, it } from 'vitest'
import { compareVersions, updateStatusFor } from '@/lib/updates'

const URL = 'https://example.test/update'

describe('compareVersions', () => {
  it('orders numerically, not as strings', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1)
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0)
    expect(compareVersions('0.2', '0.2.0')).toBe(0)
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1)
  })
})

describe('updateStatusFor', () => {
  const release = { latest: '0.3.0', minSupported: '0.2.0', reason: 'RLS fix' }

  it('says nothing when current', () => {
    expect(updateStatusFor('0.3.0', release, URL)).toBeNull()
  })

  it('offers an update between the floor and latest', () => {
    expect(updateStatusFor('0.2.5', release, URL)).toMatchObject({
      level: 'available',
      latest: '0.3.0',
      // The reason belongs to the floor; an optional update doesn't carry it.
      reason: null
    })
  })

  it('requires one below the floor, with the reason', () => {
    expect(updateStatusFor('0.1.0', release, URL)).toMatchObject({
      level: 'required',
      reason: 'RLS fix',
      updateUrl: URL
    })
  })

  it('stays quiet when the release file could not be read', () => {
    expect(updateStatusFor('0.1.0', null, URL)).toBeNull()
  })
})
