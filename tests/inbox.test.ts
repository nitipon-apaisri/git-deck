import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  INBOX_CAP,
  appendItem,
  markAllItemsRead,
  markItemRead,
  type InboxItem
} from '../src/shared/inbox'
import { Store } from '../src/main/store'
import { tempDir } from './helpers'

const item = (n: number): InboxItem => ({
  id: `i${n}`,
  title: 't',
  body: `b${n}`,
  repoKey: 'a:1',
  projectId: 'p',
  at: n,
  read: false
})
const crypto = {
  isAvailable: () => true,
  encrypt: (s: string) => Buffer.from(s),
  decrypt: (b: Buffer) => b.toString()
}

test('append puts the newest first and caps at 100', () => {
  let list: InboxItem[] = []
  for (let n = 0; n < INBOX_CAP + 5; n++) list = appendItem(list, item(n))
  assert.equal(list.length, INBOX_CAP)
  assert.equal(list[0]!.id, `i${INBOX_CAP + 4}`)
  assert.equal(list.at(-1)!.id, 'i5')
})

test('mark one and mark all read', () => {
  const list = [item(1), item(2)]
  assert.deepEqual(
    markItemRead(list, 'i1').map((i) => i.read),
    [true, false]
  )
  assert.deepEqual(markItemRead(list, 'nope'), list)
  assert.ok(markAllItemsRead(list).every((i) => i.read))
})

test('the inbox survives a reload, and a corrupt file starts empty', async () => {
  const dir = tempDir()
  const a = new Store(dir, crypto)
  await a.load()
  await a.inboxUpdate((l) => appendItem(l, item(1)))
  await a.inboxUpdate((l) => markItemRead(l, 'i1'))
  const b = new Store(dir, crypto)
  await b.load()
  assert.deepEqual(b.inboxList(), [{ ...item(1), read: true }])

  const bad = tempDir()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(`${bad}/inbox.json`, '{"items":5}')
  const c = new Store(bad, crypto)
  await c.load()
  assert.deepEqual(c.inboxList(), [])
})
