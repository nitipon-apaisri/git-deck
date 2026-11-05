import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Semaphore } from '../src/main/semaphore'

const tick = (): Promise<void> => new Promise((r) => setImmediate(r))

test('never runs more than the limit at once', async () => {
  const sem = new Semaphore(2)
  let active = 0
  let peak = 0
  const job = async (): Promise<void> => {
    active++
    peak = Math.max(peak, active)
    await tick()
    await tick()
    active--
  }
  await Promise.all(Array.from({ length: 7 }, () => sem.run(job)))
  assert.equal(peak, 2)
  assert.equal(active, 0)
})

test('waiting jobs start in order', async () => {
  const sem = new Semaphore(1)
  const order: number[] = []
  await Promise.all(
    [1, 2, 3, 4].map((n) =>
      sem.run(async () => {
        await tick()
        order.push(n)
      })
    )
  )
  assert.deepEqual(order, [1, 2, 3, 4])
})

test('a failing job frees its slot and its error reaches the caller', async () => {
  const sem = new Semaphore(1)
  await assert.rejects(
    sem.run(async () => {
      throw new Error('boom')
    }),
    /boom/
  )
  assert.equal(await sem.run(async () => 'next'), 'next')
})
