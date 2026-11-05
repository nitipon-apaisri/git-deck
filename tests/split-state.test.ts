import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DIVIDER,
  MIN_PANE_HEIGHT,
  MIN_PANE_WIDTH,
  effectiveOrientation,
  fitRatio,
  isNarrow,
  nudgeRatio,
  ratioFromPointer,
  shortcutOf,
  trackTemplate,
  type KeyLike
} from '../src/renderer/src/lib/splitLayout'
import {
  defaultSplit,
  parseSplit,
  serializeSplit,
  splitReducer,
  stillValid,
  type SplitAction,
  type SplitState
} from '../src/renderer/src/lib/splitState'

const run = (actions: SplitAction[], from: SplitState = defaultSplit()): SplitState =>
  actions.reduce(splitReducer, from)

const keys = (s: SplitState): (string | null)[] => s.panes.map((p) => p.repoKey)

// select

test('select loads the repository into the active pane and keeps that pane active', () => {
  const s = run([{ type: 'select', repoKey: 'a:1' }])
  assert.deepEqual(keys(s), ['a:1', null])
  assert.equal(s.active, 0)
  assert.equal(s.enabled, false)
})

test('select replaces what the active pane showed and leaves the other pane alone', () => {
  const s = run([
    { type: 'openInSplit', repoKey: 'a:2' }, // pane 1 now active
    { type: 'select', repoKey: 'a:3' }
  ])
  assert.deepEqual(keys(s), [null, 'a:3'])
})

test('select never puts a repository in both panes: it focuses the pane that has it', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'select', repoKey: 'a:1' }
  ])
  assert.deepEqual(keys(s), ['a:1', 'a:2'])
  assert.equal(s.active, 0)
})

test('select keeps the pane tab, so a user browsing graphs stays on graphs', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'setTab', pane: 0, tab: 'graph' },
    { type: 'select', repoKey: 'a:2' }
  ])
  assert.equal(s.panes[0].tab, 'graph')
})

test('select while split is off still finds a repo in the hidden pane', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'toggle' }, // off, pane 1 (a:2) is the one on screen
    { type: 'select', repoKey: 'a:1' }
  ])
  assert.equal(s.active, 0)
  assert.deepEqual(keys(s), ['a:1', 'a:2'])
})

// openInSplit

test('openInSplit turns split on and loads the other pane, which becomes active', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' }
  ])
  assert.equal(s.enabled, true)
  assert.deepEqual(keys(s), ['a:1', 'a:2'])
  assert.equal(s.active, 1)
})

test('openInSplit from pane 1 fills pane 0', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'openInSplit', repoKey: 'a:3' }
  ])
  assert.deepEqual(keys(s), ['a:3', 'a:2'])
  assert.equal(s.active, 0)
})

test('openInSplit for a repository that is already shown only focuses it', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'setActive', pane: 1 },
    { type: 'openInSplit', repoKey: 'a:1' }
  ])
  assert.deepEqual(keys(s), ['a:1', 'a:2'])
  assert.equal(s.active, 0)
  assert.equal(s.enabled, true)
})

test('no action ever leaves the same repository in both panes', () => {
  let s = defaultSplit()
  const actions: SplitAction[] = [
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'select', repoKey: 'a:2' },
    { type: 'swap' },
    { type: 'select', repoKey: 'a:1' },
    { type: 'toggle' },
    { type: 'select', repoKey: 'a:2' },
    { type: 'openInSplit', repoKey: 'a:2' }
  ]
  for (const action of actions) {
    s = splitReducer(s, action)
    const [x, y] = keys(s)
    assert.ok(x === null || x !== y, `duplicate after ${action.type}`)
  }
})

// active, tab

test('setActive and setTab change only what they name', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'setTab', pane: 0, tab: 'info' },
    { type: 'setActive', pane: 0 }
  ])
  assert.equal(s.panes[0].tab, 'info')
  assert.equal(s.panes[1].tab, 'overview')
  assert.equal(s.active, 0)
})

test('actions that change nothing return the same state object', () => {
  const s = run([{ type: 'select', repoKey: 'a:1' }])
  assert.equal(splitReducer(s, { type: 'setActive', pane: 0 }), s)
  assert.equal(splitReducer(s, { type: 'setTab', pane: 0, tab: 'overview' }), s)
  assert.equal(splitReducer(s, { type: 'select', repoKey: 'a:1' }), s)
  assert.equal(splitReducer(s, { type: 'setRatio', ratio: 0.5 }), s)
  assert.equal(splitReducer(s, { type: 'setOrientation', orientation: 'horizontal' }), s)
})

// close, swap, toggle

test('close turns split off and keeps the other pane, with its tab, in the first slot', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'setTab', pane: 1, tab: 'graph' },
    { type: 'close', pane: 0 }
  ])
  assert.equal(s.enabled, false)
  assert.deepEqual(keys(s), ['a:2', null])
  assert.equal(s.panes[0].tab, 'graph')
  assert.equal(s.active, 0)
})

test('closing pane 1 keeps pane 0', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'close', pane: 1 }
  ])
  assert.deepEqual(keys(s), ['a:1', null])
  assert.equal(s.enabled, false)
})

test('swap exchanges the panes and the active pane follows its repository', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'setTab', pane: 0, tab: 'info' },
    { type: 'swap' }
  ])
  assert.deepEqual(keys(s), ['a:2', 'a:1'])
  assert.equal(s.panes[1].tab, 'info')
  assert.equal(s.active, 0) // a:2 was active, and is still
})

test('toggle on makes an empty pane the active one', () => {
  const s = run([{ type: 'select', repoKey: 'a:1' }, { type: 'toggle' }])
  assert.equal(s.enabled, true)
  assert.equal(s.active, 1)
  assert.equal(s.panes[1].repoKey, null)
})

test('toggle on with both panes full keeps the active pane, and toggle off keeps both repos', () => {
  const on = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'a:2' },
    { type: 'setActive', pane: 0 }
  ])
  const off = splitReducer(on, { type: 'toggle' })
  assert.equal(off.enabled, false)
  assert.deepEqual(keys(off), ['a:1', 'a:2'])
  const again = splitReducer(off, { type: 'toggle' })
  assert.equal(again.enabled, true)
  assert.equal(again.active, 0)
})

// ratio, orientation

test('setRatio clamps to 25-75 % and ignores NaN', () => {
  assert.equal(run([{ type: 'setRatio', ratio: 0.1 }]).ratio, 0.25)
  assert.equal(run([{ type: 'setRatio', ratio: 0.99 }]).ratio, 0.75)
  assert.equal(run([{ type: 'setRatio', ratio: 0.6 }]).ratio, 0.6)
  assert.equal(run([{ type: 'setRatio', ratio: Number.NaN }]).ratio, 0.5)
  assert.equal(run([{ type: 'setRatio', ratio: Infinity }]).ratio, 0.5)
})

test('setOrientation', () => {
  assert.equal(run([{ type: 'setOrientation', orientation: 'vertical' }]).orientation, 'vertical')
})

// prune

test('pruneRepos empties a pane whose repository is gone and resets its tab', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'b:2' },
    { type: 'setTab', pane: 1, tab: 'graph' },
    { type: 'pruneRepos', validKeys: new Set(['a:1']) }
  ])
  assert.deepEqual(keys(s), ['a:1', null])
  assert.equal(s.panes[1].tab, 'overview')
  assert.equal(s.enabled, true)
})

test('pruneRepos with every key valid changes nothing', () => {
  const s = run([{ type: 'select', repoKey: 'a:1' }])
  assert.equal(splitReducer(s, { type: 'pruneRepos', validKeys: new Set(['a:1']) }), s)
})

test('stillValid keeps repos that are listed, or whose account list failed to load', () => {
  const known = new Set(['a:1'])
  const accounts = { a: { error: null }, b: { error: 'offline' } }
  assert.equal(stillValid('a:1', known, accounts), true)
  assert.equal(stillValid('a:9', known, accounts), false) // account loaded, repo gone
  assert.equal(stillValid('b:5', known, accounts), true) // cannot tell: list failed
  assert.equal(stillValid('c:1', known, accounts), false) // account removed
  assert.equal(stillValid('nocolon', known, accounts), false)
})

// persistence

test('the state survives a JSON round trip', () => {
  const s = run([
    { type: 'select', repoKey: 'a:1' },
    { type: 'openInSplit', repoKey: 'b:2' },
    { type: 'setTab', pane: 1, tab: 'graph' },
    { type: 'setOrientation', orientation: 'vertical' },
    { type: 'setRatio', ratio: 0.4 }
  ])
  assert.deepEqual(parseSplit(serializeSplit(s)), s)
})

test('missing and corrupt JSON fall back to the default', () => {
  assert.deepEqual(parseSplit(null), defaultSplit())
  assert.deepEqual(parseSplit('{nope'), defaultSplit())
  assert.deepEqual(parseSplit('"a string"'), defaultSplit())
  assert.deepEqual(parseSplit('null'), defaultSplit())
  assert.deepEqual(parseSplit('[]'), defaultSplit())
})

test('a wrong shape falls back to the default, field by field', () => {
  const good = defaultSplit()
  const bad = (change: Record<string, unknown>): string => JSON.stringify({ ...good, ...change })
  assert.deepEqual(parseSplit(bad({ enabled: 'yes' })), good)
  assert.deepEqual(parseSplit(bad({ orientation: 'diagonal' })), good)
  assert.deepEqual(parseSplit(bad({ ratio: 'half' })), good)
  assert.deepEqual(parseSplit(bad({ ratio: null })), good)
  assert.deepEqual(parseSplit(bad({ active: 2 })), good)
  assert.deepEqual(parseSplit(bad({ panes: [] })), good)
  assert.deepEqual(parseSplit(bad({ panes: [good.panes[0]] })), good)
  assert.deepEqual(
    parseSplit(bad({ panes: [good.panes[0], { repoKey: 5, tab: 'overview' }] })),
    good
  )
  assert.deepEqual(
    parseSplit(bad({ panes: [good.panes[0], { repoKey: null, tab: 'files' }] })),
    good
  )
})

test('a stored ratio outside the range is clamped, and a duplicate repository is refused', () => {
  const stored = { ...defaultSplit(), enabled: true, ratio: 5 }
  assert.equal(parseSplit(JSON.stringify(stored)).ratio, 0.75)
  const twice = {
    ...defaultSplit(),
    panes: [
      { repoKey: 'a:1', tab: 'overview' },
      { repoKey: 'a:1', tab: 'graph' }
    ]
  }
  assert.deepEqual(parseSplit(JSON.stringify(twice)), defaultSplit())
})

// layout

test('side by side falls back to stacked below two minimum panes plus the divider', () => {
  const need = 2 * MIN_PANE_WIDTH + DIVIDER
  assert.equal(effectiveOrientation('horizontal', need), 'horizontal')
  assert.equal(effectiveOrientation('horizontal', need - 1), 'vertical')
  assert.equal(effectiveOrientation('vertical', 3000), 'vertical')
  assert.equal(effectiveOrientation('horizontal', 0), 'horizontal') // not measured yet
})

test('fitRatio keeps both panes at their minimum size as well as within 25-75 %', () => {
  // 1000 px area: 988 px of space; 360 px is 36.4 %
  const min = MIN_PANE_WIDTH
  const low = min / 988
  assert.ok(Math.abs(fitRatio(0.25, 1000, min) - low) < 1e-9)
  assert.ok(Math.abs(fitRatio(0.75, 1000, min) - (1 - low)) < 1e-9)
  assert.equal(fitRatio(0.5, 1000, min), 0.5)
  // a big area: only the 25-75 % limits apply
  assert.equal(fitRatio(0.1, 4000, min), 0.25)
  assert.equal(fitRatio(0.9, 4000, min), 0.75)
})

test('fitRatio splits evenly when the minimums do not fit, and survives bad input', () => {
  assert.equal(fitRatio(0.3, 600, MIN_PANE_WIDTH), 0.5)
  assert.equal(fitRatio(Number.NaN, 1000, MIN_PANE_WIDTH), 0.5)
  assert.equal(fitRatio(0.3, 0, MIN_PANE_HEIGHT), 0.3)
})

test('ratioFromPointer puts the divider centre under the pointer', () => {
  // area starts at x=100, 1012 wide: 1000 px of space, divider centre at 100 + 6 + 500
  assert.equal(ratioFromPointer(606, 100, 1012, MIN_PANE_WIDTH), 0.5)
  assert.ok(Math.abs(ratioFromPointer(100 + 6 + 450, 100, 1012, MIN_PANE_WIDTH) - 0.45) < 1e-9)
  assert.equal(ratioFromPointer(-500, 100, 1012, MIN_PANE_WIDTH), 0.36)
  assert.equal(ratioFromPointer(5000, 100, 1012, MIN_PANE_WIDTH), 0.64)
  assert.equal(ratioFromPointer(300, 0, DIVIDER, MIN_PANE_HEIGHT), 0.5)
})

test('stacked panes use the 240 px minimum', () => {
  const space = 700 - DIVIDER
  assert.ok(Math.abs(fitRatio(0.25, 700, MIN_PANE_HEIGHT) - MIN_PANE_HEIGHT / space) < 1e-9)
})

test('nudgeRatio moves 2 % and does not drift', () => {
  assert.equal(nudgeRatio(0.5, 1), 0.52)
  assert.equal(nudgeRatio(0.5, -1), 0.48)
  let r = 0.5
  for (let i = 0; i < 10; i++) r = nudgeRatio(r, 1)
  assert.equal(r, 0.7)
})

test('trackTemplate gives the minimum and a share to each pane', () => {
  assert.equal(trackTemplate(0.5, 'horizontal'), 'minmax(360px, 500fr) 12px minmax(360px, 500fr)')
  assert.equal(trackTemplate(0.25, 'vertical'), 'minmax(240px, 250fr) 12px minmax(240px, 750fr)')
})

test('isNarrow is under 640 px and never for an unmeasured pane', () => {
  assert.equal(isNarrow(639), true)
  assert.equal(isNarrow(640), false)
  assert.equal(isNarrow(0), false)
})

// shortcuts

const key = (code: string, over: Partial<KeyLike> = {}): KeyLike => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...over
})

test('Ctrl/Cmd+Alt+S toggles, on either modifier', () => {
  assert.equal(shortcutOf(key('KeyS', { ctrlKey: true, altKey: true })), 'toggle')
  assert.equal(shortcutOf(key('KeyS', { metaKey: true, altKey: true })), 'toggle')
})

test('Ctrl/Cmd+1 and +2 focus a pane', () => {
  assert.equal(shortcutOf(key('Digit1', { ctrlKey: true })), 'pane1')
  assert.equal(shortcutOf(key('Digit2', { metaKey: true })), 'pane2')
})

test('other chords are not shortcuts', () => {
  assert.equal(shortcutOf(key('KeyS', { ctrlKey: true })), null) // save, not ours
  assert.equal(shortcutOf(key('KeyS', { altKey: true })), null)
  assert.equal(shortcutOf(key('Digit1')), null) // typing a 1
  assert.equal(shortcutOf(key('Digit3', { ctrlKey: true })), null)
  assert.equal(shortcutOf(key('Digit1', { ctrlKey: true, altKey: true })), null)
  assert.equal(shortcutOf(key('Digit1', { ctrlKey: true, shiftKey: true })), null)
  assert.equal(shortcutOf(key('Digit1', { ctrlKey: true, metaKey: true })), null)
})
