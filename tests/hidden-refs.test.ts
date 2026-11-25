import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getGraph } from '../src/main/git'
import { refArgs, refFullName, visibleRefs } from '../src/shared/hiddenRefs'
import { HIDDEN_KEY, parseHidden, setHidden } from '../src/renderer/src/lib/hiddenRefs'
import { commit, emptyRepo, git } from './helpers'

test('refArgs puts each --exclude before its own namespace flag', () => {
  assert.deepEqual(refArgs(['refs/heads/a', 'refs/tags/v1', 'refs/remotes/origin/x']), [
    '--exclude=a',
    '--branches',
    '--exclude=origin/x',
    '--remotes',
    '--exclude=v1',
    '--tags'
  ])
  assert.deepEqual(refArgs([]), ['--branches', '--remotes', '--tags'])
})

test('visibleRefs drops hidden refs and never HEAD', () => {
  const refs = [
    { name: 'HEAD', kind: 'head' as const },
    { name: 'a', kind: 'branch' as const },
    { name: 'v1', kind: 'tag' as const }
  ]
  assert.equal(refFullName('head', 'HEAD'), null)
  assert.deepEqual(
    visibleRefs(refs, new Set(['refs/heads/a', 'refs/heads/HEAD'])).map((r) => r.name),
    ['HEAD', 'v1']
  )
})

test('the graph omits commits only a hidden ref reaches and keeps shared ones', async () => {
  const dir = emptyRepo()
  const base = commit(dir, 'a', 'base')
  git(dir, 'tag', 'v1')
  git(dir, 'checkout', '-q', '-b', 'side')
  const only = commit(dir, 'b', 'only on side')
  git(dir, 'checkout', '-q', 'main')
  const main = commit(dir, 'c', 'on main')
  const all = (await getGraph(dir, 0, 50)).map((c) => c.hash)
  assert.deepEqual(new Set(all), new Set([base, only, main]))

  const hidden = await getGraph(dir, 0, 50, ['refs/heads/side'])
  assert.deepEqual(new Set(hidden.map((c) => c.hash)), new Set([base, main]))

  // Hiding the tag keeps its commit (main reaches it) but drops the pill.
  const noTag = await getGraph(dir, 0, 50, ['refs/tags/v1'])
  assert.equal(noTag.length, 3)
  assert.equal(
    noTag.some((c) => c.refs.some((r) => r.kind === 'tag')),
    false
  )
})

test('hidden store round-trips and drops empty repos', () => {
  assert.equal(HIDDEN_KEY, 'gitdeck.hiddenRefs')
  let map = setHidden({}, '/r', 'refs/heads/a', true)
  map = setHidden(map, '/r', 'refs/heads/a', true)
  assert.deepEqual(map, { '/r': ['refs/heads/a'] })
  assert.deepEqual(parseHidden(JSON.stringify(map)), map)
  assert.deepEqual(setHidden(map, '/r', 'refs/heads/a', false), {})
  assert.deepEqual(parseHidden('nonsense'), {})
  assert.deepEqual(parseHidden('[1]'), {})
})
