import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  menuLayout,
  refActions,
  remoteGroups,
  remoteOnly,
  remoteState,
  trackingText
} from '../src/renderer/src/lib/branchView'
import { refMenuEntries } from '../src/renderer/src/lib/refMenu'
import type { BranchList, LocalBranch } from '../src/shared/types'

const branch = (name: string, extra: Partial<LocalBranch> = {}): LocalBranch => ({
  name,
  upstream: null,
  gone: false,
  ahead: 0,
  behind: 0,
  current: false,
  ...extra
})

const list = (extra: Partial<BranchList> = {}): BranchList => ({
  current: 'main',
  detached: false,
  local: [branch('main', { current: true, upstream: 'origin/main' })],
  remote: ['origin/main'],
  remotes: ['origin'],
  ...extra
})

test('trackingText shows ahead, behind and a deleted upstream', () => {
  assert.equal(trackingText(branch('a')), '')
  assert.equal(trackingText(branch('a', { ahead: 2 })), '↑2')
  assert.equal(trackingText(branch('a', { behind: 1 })), '↓1')
  assert.equal(trackingText(branch('a', { ahead: 2, behind: 1 })), '↑2 ↓1')
  assert.equal(trackingText(branch('a', { gone: true })), 'gone')
})

test('remoteOnly lists remote branches with no local twin or tracking branch', () => {
  const l = list({
    local: [
      branch('main', { current: true, upstream: 'origin/main' }),
      branch('mine', { upstream: 'origin/theirs' })
    ],
    remote: ['origin/main', 'origin/theirs', 'origin/new', 'origin/feature/deep', 'fork/mine']
  })
  assert.deepEqual(remoteOnly(l), ['origin/new', 'origin/feature/deep'])
})

test('remoteState: off while loading, detached, or with no remote', () => {
  assert.equal(remoteState(null).push.enabled, false)
  const detached = remoteState(list({ current: null, detached: true, local: [] }))
  assert.match(detached.pull.title, /detached/)
  assert.equal(detached.push.enabled, false)
  const none = remoteState(list({ remotes: [] }))
  assert.match(none.push.title, /no remote/)
  assert.equal(none.pull.enabled, false)
})

test('remoteState: a branch with no upstream can be published but not pulled', () => {
  const s = remoteState(list({ local: [branch('topic', { current: true })], current: 'topic' }))
  assert.equal(s.push.enabled, true)
  assert.equal(s.push.label, 'Publish')
  assert.equal(s.pull.enabled, false)
  assert.equal(s.force, false)
})

test('remoteState: push needs commits to send, pull is always possible with an upstream', () => {
  const inSync = remoteState(list())
  assert.equal(inSync.push.enabled, false)
  assert.equal(inSync.push.label, 'Push')
  assert.equal(inSync.pull.enabled, true)
  assert.equal(inSync.force, true)
  const diverged = remoteState(
    list({
      local: [branch('main', { current: true, upstream: 'origin/main', ahead: 2, behind: 1 })]
    })
  )
  assert.equal(diverged.push.enabled, true)
  assert.match(diverged.push.title, /Push 2 commits/)
  assert.match(diverged.pull.title, /Pull 1 commit /)
  assert.deepEqual([diverged.ahead, diverged.behind], [2, 1])
  const gone = remoteState(
    list({ local: [branch('main', { current: true, upstream: 'origin/main', gone: true })] })
  )
  assert.equal(gone.pull.enabled, false)
  assert.equal(gone.push.label, 'Publish')
})

test('refActions: another local branch can be checked out or deleted', () => {
  const items = refActions({ kind: 'branch', name: 'topic' }, 'abc1234')
  assert.deepEqual(
    items.map((i) => i.id),
    ['checkout', 'delete', 'copy-name', 'checkout-commit', 'create-branch', 'copy-hash']
  )
  assert.equal(items.find((i) => i.id === 'delete')?.danger, true)
})

test('refActions: the current branch is never offered for delete or checkout', () => {
  const items = refActions({ kind: 'branch', name: 'main', current: true }, 'abc1234')
  assert.ok(!items.some((i) => i.action.type === 'delete-branch'))
  assert.ok(!items.some((i) => i.action.type === 'checkout-branch'))
  assert.ok(items.some((i) => i.action.type === 'rename-branch'))
})

test('refActions: a remote branch checks out as tracking, a tag only copies, a row has commit actions', () => {
  const remote = refActions({ kind: 'remote', name: 'origin/x' }, 'abc1234')
  assert.equal(remote[0].action.type, 'checkout-remote')
  assert.ok(!remote.some((i) => i.action.type === 'delete-branch'))
  const tag = refActions({ kind: 'tag', name: 'v1' }, 'abc1234')
  assert.deepEqual(
    tag.map((i) => i.id),
    ['copy-name', 'checkout-commit', 'create-branch', 'copy-hash']
  )
  const row = refActions(null, 'abc1234')
  assert.deepEqual(
    row.map((i) => i.group),
    ['commit', 'commit', 'commit']
  )
  assert.deepEqual(row[1].action, { type: 'create-branch', startPoint: 'abc1234' })
})

const ctx = { currentBranch: 'main', isMerge: false, operationActive: false }
const ids = (items: { id: string }[]): string[] => items.map((i) => i.id)

test('refActions offers merge for other branches and remote branches, not the current one', () => {
  const other = refActions({ kind: 'branch', name: 'feature' }, 'abc1234', ctx)
  assert.ok(ids(other).includes('merge') && ids(other).includes('merge-no-ff'))
  const merge = other.find((i) => i.id === 'merge')
  assert.deepEqual(merge?.action, { type: 'merge', branch: 'feature', noFf: false })
  assert.match(merge?.label ?? '', /Merge feature into main/)
  assert.equal(other.find((i) => i.id === 'merge-no-ff')?.action.type, 'merge')

  const remote = refActions({ kind: 'remote', name: 'origin/dev' }, 'abc1234', ctx)
  assert.ok(ids(remote).includes('merge'))
  const current = refActions({ kind: 'branch', name: 'main', current: true }, 'abc1234', ctx)
  assert.ok(!ids(current).includes('merge'))
  const tag = refActions({ kind: 'tag', name: 'v1' }, 'abc1234', ctx)
  assert.ok(!ids(tag).includes('merge'))
})

test('refActions offers cherry-pick on a plain commit only when it is safe to start', () => {
  assert.ok(ids(refActions(null, 'abc1234', ctx)).includes('cherry-pick'))
  const item = refActions(null, 'abc1234', ctx).find((i) => i.id === 'cherry-pick')
  assert.deepEqual(item?.action, { type: 'cherry-pick', hash: 'abc1234' })
  assert.match(item?.label ?? '', /onto main/)
  // A merge commit needs a mainline, HEAD must be a branch, and one operation at a time.
  assert.ok(!ids(refActions(null, 'abc1234', { ...ctx, isMerge: true })).includes('cherry-pick'))
  assert.ok(
    !ids(refActions(null, 'abc1234', { ...ctx, currentBranch: null })).includes('cherry-pick')
  )
  const busy = refActions({ kind: 'branch', name: 'feature' }, 'abc1234', {
    ...ctx,
    operationActive: true
  })
  assert.ok(!ids(busy).includes('cherry-pick') && !ids(busy).includes('merge'))
  // No context means a pane that cannot write.
  const none = refActions({ kind: 'branch', name: 'feature' }, 'abc1234')
  assert.ok(!ids(none).includes('cherry-pick') && !ids(none).includes('merge'))
})

test('refActions offers revert, tag and reset on a commit, each only when it is safe', () => {
  const all = ids(refActions(null, 'abc1234', ctx))
  for (const id of ['revert', 'create-tag', 'reset-soft', 'reset-mixed', 'reset-hard']) {
    assert.ok(all.includes(id), id)
  }
  const items = refActions(null, 'abc1234', ctx)
  assert.deepEqual(items.find((i) => i.id === 'revert')?.action, {
    type: 'revert',
    hash: 'abc1234'
  })
  assert.deepEqual(items.find((i) => i.id === 'create-tag')?.action, {
    type: 'create-tag',
    hash: 'abc1234'
  })
  const hard = items.find((i) => i.id === 'reset-hard')
  assert.deepEqual(hard?.action, { type: 'reset', hash: 'abc1234', mode: 'hard' })
  assert.equal(hard?.danger, true)
  assert.match(hard?.label ?? '', /^Hard/)
  assert.equal(hard?.submenu, 'reset')
  assert.ok(!items.find((i) => i.id === 'reset-soft')?.danger)

  // A merge commit cannot be reverted without a mainline, but it can be tagged and reset to.
  const merge = ids(refActions(null, 'abc1234', { ...ctx, isMerge: true }))
  assert.ok(
    !merge.includes('revert') && merge.includes('create-tag') && merge.includes('reset-soft')
  )
  // Detached: no revert, reset says HEAD.
  const detached = refActions(null, 'abc1234', { ...ctx, currentBranch: null })
  assert.ok(!ids(detached).includes('revert'))
  assert.equal(
    menuLayout(detached, null).find((r) => r.kind === 'submenu' && r.id === 'reset')?.kind,
    'submenu'
  )
  // While an operation waits only tagging stays.
  const busy = ids(refActions(null, 'abc1234', { ...ctx, operationActive: true }))
  assert.ok(busy.includes('create-tag'))
  assert.ok(!busy.includes('revert') && !busy.includes('reset-hard'))
  // A pane that cannot write offers none of them.
  const none = ids(refActions(null, 'abc1234'))
  assert.ok(
    !none.includes('create-tag') && !none.includes('revert') && !none.includes('reset-soft')
  )
})

test('refActions offers rebase onto a branch, a remote branch and a commit when it is safe to start', () => {
  const other = refActions({ kind: 'branch', name: 'feature' }, 'abc1234', ctx)
  const onBranch = other.find((i) => i.id === 'rebase')
  assert.deepEqual(onBranch?.action, { type: 'rebase', onto: 'feature' })
  assert.match(onBranch?.label ?? '', /Rebase main onto feature/)
  const remote = refActions({ kind: 'remote', name: 'origin/dev' }, 'abc1234', ctx)
  assert.deepEqual(remote.find((i) => i.id === 'rebase')?.action, {
    type: 'rebase',
    onto: 'origin/dev'
  })
  const row = refActions(null, 'abc1234', ctx).find((i) => i.id === 'rebase-commit')
  assert.deepEqual(row?.action, { type: 'rebase', onto: 'abc1234' })
  assert.match(row?.label ?? '', /Rebase main onto this commit/)
  // Not onto the current branch, not detached, not while another operation waits, not read-only.
  const current = refActions({ kind: 'branch', name: 'main', current: true }, 'abc1234', ctx)
  assert.ok(!ids(current).includes('rebase'))
  assert.ok(
    !ids(refActions(null, 'abc1234', { ...ctx, currentBranch: null })).includes('rebase-commit')
  )
  const busy = ids(
    refActions({ kind: 'branch', name: 'feature' }, 'abc1234', { ...ctx, operationActive: true })
  )
  assert.ok(!busy.includes('rebase') && !busy.includes('rebase-commit'))
  assert.ok(!ids(refActions(null, 'abc1234')).includes('rebase-commit'))
  // A merge commit can be a rebase target.
  assert.ok(ids(refActions(null, 'abc1234', { ...ctx, isMerge: true })).includes('rebase-commit'))
})

test('refActions: a remote branch can be deleted on its remote, the selector has no commit actions', () => {
  const remote = refActions({ kind: 'remote', name: 'origin/dev' }, null, ctx)
  assert.deepEqual(remote.find((i) => i.id === 'delete-remote')?.action, {
    type: 'delete-remote-branch',
    name: 'origin/dev'
  })
  assert.equal(remote.find((i) => i.id === 'delete-remote')?.danger, true)
  // Without a hash only ref actions remain: no commit, reset or hash copy.
  assert.ok(remote.every((i) => i.group === 'ref'))
  assert.ok(!ids(remote).includes('reset-hard') && !ids(remote).includes('copy-hash'))
  const local = refActions({ kind: 'branch', name: 'topic' }, null, ctx)
  assert.deepEqual(
    ids(local).filter((id) => id === 'delete' || id === 'copy-name'),
    ['delete', 'copy-name']
  )
  assert.ok(!ids(local).includes('delete-remote'))
})

test('menuLayout: ref and commit actions, then Reset and Copy submenus', () => {
  const rows = menuLayout(refActions({ kind: 'branch', name: 'feature' }, 'abc1234', ctx), 'main')
  const kinds = rows.map((r) => r.kind)
  // A rule between the ref and commit groups, and another before the submenus.
  assert.equal(kinds.filter((k) => k === 'separator').length, 2)
  assert.deepEqual(kinds.slice(-2), ['submenu', 'submenu'])
  const reset = rows.find((r) => r.kind === 'submenu' && r.id === 'reset')
  assert.ok(reset?.kind === 'submenu')
  assert.equal(reset.label, 'Reset main to here')
  assert.deepEqual(
    reset.items.map((i) => i.id),
    ['reset-soft', 'reset-mixed', 'reset-hard']
  )
  const copy = rows.find((r) => r.kind === 'submenu' && r.id === 'copy')
  assert.ok(copy?.kind === 'submenu')
  assert.deepEqual(
    copy.items.map((i) => i.id),
    ['copy-name', 'copy-hash']
  )
  // No top-level item is a reset or a copy any more.
  assert.ok(!rows.some((r) => r.kind === 'item' && /^(reset|copy)/.test(r.item.id)))
  // A pane that cannot write has no Reset submenu, but still copies.
  const readOnly = menuLayout(refActions(null, 'abc1234'), null)
  assert.ok(!readOnly.some((r) => r.kind === 'submenu' && r.id === 'reset'))
  // A lone copy action is an item, not a submenu of one.
  assert.ok(!readOnly.some((r) => r.kind === 'submenu'))
  assert.ok(readOnly.some((r) => r.kind === 'item' && r.item.id === 'copy-hash'))
  const selector = menuLayout(refActions({ kind: 'branch', name: 'topic' }, null, ctx), 'main')
  assert.ok(!selector.some((r) => r.kind === 'submenu'))
  assert.ok(selector.some((r) => r.kind === 'item' && r.item.id === 'copy-name'))
})

test('refMenuEntries: busy switches off everything but copying', () => {
  const run: string[] = []
  const items = refActions({ kind: 'branch', name: 'feature' }, 'abc1234', ctx)
  const entries = refMenuEntries(items, 'main', true, (a) => run.push(a.type))
  const find = (id: string) => entries.find((e) => e.id === id)
  const reset = find('reset')
  const copy = find('copy')
  assert.ok(reset?.kind === 'submenu' && copy?.kind === 'submenu')
  assert.equal(reset.disabled, true)
  assert.equal(copy.disabled, false)
  assert.ok(copy.entries.every((e) => e.kind === 'item' && !e.disabled))
  const checkout = find('checkout')
  assert.ok(checkout?.kind === 'item' && checkout.disabled)
  // Choosing an enabled item runs its action.
  const idle = refMenuEntries(items, 'main', false, (a) => run.push(a.type))
  const del = idle.find((e) => e.id === 'delete')
  assert.ok(del?.kind === 'item')
  del.onSelect()
  assert.deepEqual(run, ['delete-branch'])
})

test('remoteGroups lists every remote branch under its own remote, twins included', () => {
  const l = list({
    remotes: ['origin', 'fork', 'empty'],
    remote: ['origin/main', 'origin/feature/deep', 'fork/dev', 'fork/origin/odd']
  })
  assert.deepEqual(remoteGroups(l), [
    { remote: 'origin', names: ['origin/main', 'origin/feature/deep'] },
    { remote: 'fork', names: ['fork/dev', 'fork/origin/odd'] }
  ])
  assert.deepEqual(remoteGroups(list({ remotes: [], remote: [] })), [])
})
