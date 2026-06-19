import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

const ORIG = { ...process.env }
afterEach(() => {
  process.env = { ...ORIG }
})

describe('loadConfig auth safety rail', () => {
  it('refuses AUTH_BYPASS while DATABASE_URL is set (never disable auth against a real DB)', () => {
    process.env.AUTH_BYPASS = '1'
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
    expect(() => loadConfig()).toThrow(/AUTH_BYPASS/)
  })

  it('allows AUTH_BYPASS with embedded pglite (no DATABASE_URL)', () => {
    process.env.AUTH_BYPASS = '1'
    delete process.env.DATABASE_URL
    const c = loadConfig()
    expect(c.authBypass).toBe(true)
    expect(c.databaseUrl).toBeUndefined()
  })

  it('defaults authBypass off', () => {
    delete process.env.AUTH_BYPASS
    delete process.env.DATABASE_URL
    expect(loadConfig().authBypass).toBe(false)
  })
})
