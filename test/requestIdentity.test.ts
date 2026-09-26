import { describe, expect, it } from 'vitest'
import {
  getRequestIdentity,
  runWithRequestIdentity,
  setRequestIdentity
} from '@/lib/requestIdentity'

// The regression this guards: under React's cache() the write below landed
// in a throwaway slot outside a render, so every MCP request resolved as
// anonymous and redirected to /login.
describe('requestIdentity', () => {
  it('reads back what was set inside the scope', () => {
    runWithRequestIdentity(() => {
      setRequestIdentity({ userId: 'u1', companyId: 'c1' })
      expect(getRequestIdentity()).toEqual({ userId: 'u1', companyId: 'c1' })
    })
  })

  it('survives an await between set and get', async () => {
    await runWithRequestIdentity(async () => {
      setRequestIdentity({ userId: 'u1', companyId: 'c1' })
      await Promise.resolve()
      expect(getRequestIdentity()?.userId).toBe('u1')
    })
  })

  it('is null outside any scope, and never leaks across two', async () => {
    expect(getRequestIdentity()).toBeNull()

    const one = runWithRequestIdentity(async () => {
      setRequestIdentity({ userId: 'u1', companyId: 'c1' })
      await new Promise((r) => setTimeout(r, 10))
      return getRequestIdentity()
    })
    const two = runWithRequestIdentity(async () => {
      setRequestIdentity({ userId: 'u2', companyId: 'c2' })
      return getRequestIdentity()
    })

    expect((await one)?.userId).toBe('u1')
    expect((await two)?.userId).toBe('u2')
    expect(getRequestIdentity()).toBeNull()
  })

  it('throws rather than silently dropping the override', () => {
    expect(() => setRequestIdentity({ userId: 'u', companyId: 'c' })).toThrow()
  })
})
