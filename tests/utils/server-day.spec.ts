import { describe, expect, it } from 'vitest'

import { getServerDayKey } from '../../utils/server-day'

describe('server day key', () => {
  it('uses the server-compatible UTC day string', () => {
    expect(getServerDayKey(new Date('2026-03-11T08:30:00.000Z'))).toBe('2026-03-11')
    expect(getServerDayKey(new Date('2026-03-10T23:30:00.000-09:00'))).toBe('2026-03-11')
  })
})
