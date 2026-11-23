import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changelog } from '../src/main/git'
import {
  changelogMarkdown,
  groupChangelog,
  parseSubject,
  type ChangelogCommit
} from '../src/shared/changelog'
import { commit, emptyRepo, git } from './helpers'

const c = (subject: string, merge = false): ChangelogCommit => ({
  hash: 'abcdef1234567',
  author: 'Test',
  at: 0,
  subject,
  merge
})

test('parseSubject: gitmoji, conventional and unknown subjects', () => {
  assert.deepEqual(parseSubject('✨ (feat): add x'), { type: 'feat', text: 'add x' })
  assert.deepEqual(parseSubject('🐛 (bug): fix y'), { type: 'bug', text: 'fix y' })
  assert.deepEqual(parseSubject('fix(core): z'), { type: 'bug', text: 'z' })
  assert.deepEqual(parseSubject('feat!: big'), { type: 'feat', text: 'big' })
  assert.deepEqual(parseSubject('Update readme'), { type: 'other', text: 'Update readme' })
  assert.deepEqual(parseSubject('wip: stuff'), { type: 'other', text: 'wip: stuff' })
})

test('groupChangelog: fixed order, merges apart, empty groups dropped', () => {
  const groups = groupChangelog([
    c('🐛 (bug): a'),
    c('✨ (feat): b'),
    c('🔀 (merge): m', true),
    c('x')
  ])
  assert.deepEqual(
    groups.map((g) => g.type),
    ['feat', 'bug', 'merge', 'other']
  )
  assert.deepEqual(groupChangelog([]), [])
})

test('changelogMarkdown: heading, groups and the empty case', () => {
  const md = changelogMarkdown('v1', 'v2', groupChangelog([c('✨ (feat): add x')]))
  assert.equal(md, '## v2\n\nChanges since v1.\n\n### Features\n\n- add x (abcdef1)\n')
  assert.match(changelogMarkdown(null, 'v1', []), /All changes\.\n\nNo changes\./)
})

test('changelog: range between tags, no previous tag, merges, empty range, bad ref', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', '✨ (feat): first')
  git(dir, 'tag', 'v1')
  git(dir, 'checkout', '-q', '-b', 'side')
  commit(dir, 'b.txt', '🐛 (bug): side')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'c.txt', 'main work')
  git(dir, 'merge', '-q', '--no-ff', '-m', '🔀 (merge): side', 'side')
  git(dir, 'tag', 'v2')

  const range = await changelog(dir, 'v1', 'v2')
  assert.deepEqual(
    range.map((x) => x.subject).sort(),
    ['main work', '🐛 (bug): side', '🔀 (merge): side'].sort()
  )
  assert.equal(range.filter((x) => x.merge).length, 1)

  assert.equal((await changelog(dir, null, 'v1')).length, 1)
  assert.equal((await changelog(dir, 'v2', 'v2')).length, 0)
  await assert.rejects(changelog(dir, 'nope', 'v2'), /no tag or commit/)
  await assert.rejects(changelog(dir, '--all', 'v2'), /no tag or commit/)
})
