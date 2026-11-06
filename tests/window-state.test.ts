import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fitToDisplays, loadWindowState, saveWindowState } from '../src/main/windowState'

const area = { x: 0, y: 0, width: 1920, height: 1080 }

test('defaults when nothing is saved or the file is broken', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ws-'))
  assert.deepEqual(await loadWindowState(dir), { width: 1280, height: 800, maximized: false })
  await writeFile(join(dir, 'window-state.json'), '{nope')
  assert.equal((await loadWindowState(dir)).width, 1280)
})

test('round-trips bounds and the maximized flag', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ws-'))
  await saveWindowState(dir, { x: 40, y: 50, width: 1500, height: 900, maximized: true })
  assert.deepEqual(await loadWindowState(dir), {
    x: 40,
    y: 50,
    width: 1500,
    height: 900,
    maximized: true
  })
})

test('a saved size below the minimum is raised to it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ws-'))
  await saveWindowState(dir, { width: 200, height: 100, maximized: false })
  const s = await loadWindowState(dir)
  assert.equal(s.width, 1100)
  assert.equal(s.height, 700)
})

test('a position on no display is dropped, one on a display is kept', () => {
  const on = { x: 100, y: 100, width: 1280, height: 800, maximized: false }
  assert.equal(fitToDisplays(on, [area]).x, 100)
  const off = { ...on, x: 4000 }
  const fitted = fitToDisplays(off, [area])
  assert.equal(fitted.x, undefined)
  assert.equal(fitted.width, 1280)
})
