import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapLimit } from '../src/shared/pool'

describe('mapLimit', () => {
  it('keeps input order and respects the limit', async () => {
    let active = 0
    let peak = 0
    const out = await mapLimit([30, 5, 20, 1, 10], 2, async (ms) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, ms))
      active--
      return ms * 2
    })
    assert.deepEqual(out, [60, 10, 40, 2, 20])
    assert.equal(peak, 2)
  })

  it('handles an empty list', async () => {
    assert.deepEqual(await mapLimit([], 4, async (x) => x), [])
  })
})
