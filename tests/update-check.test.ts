import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureFetch } from '../src/main/http'
import { checkForUpdate, isNewer, parseRelease } from '../src/main/updateCheck'

const release = { tag_name: 'v1.2.0', html_url: 'https://github.com/o/r/releases/tag/v1.2.0' }
const reply = (status: number, body: unknown) => async () =>
  new Response(JSON.stringify(body), { status })

test('isNewer compares major, minor and patch numerically', () => {
  assert.ok(isNewer('1.0.0', '1.0.1'))
  assert.ok(isNewer('1.9.0', 'v1.10.0'))
  assert.ok(isNewer('0.9.9', '1.0.0'))
  assert.ok(!isNewer('1.0.0', '1.0.0'))
  assert.ok(!isNewer('1.2.0', '1.1.9'))
  assert.ok(!isNewer('1.0.0', '1.0.0-beta.1'))
  assert.ok(!isNewer('1.0.0', 'latest'))
  assert.ok(!isNewer('dev', '1.0.0'))
})

test('parseRelease accepts a GitHub release and rejects anything else', () => {
  assert.deepEqual(parseRelease(release), { version: '1.2.0', url: release.html_url })
  assert.equal(parseRelease(null), null)
  assert.equal(parseRelease({ tag_name: 'nightly', html_url: release.html_url }), null)
  assert.equal(parseRelease({ tag_name: 'v1.0.0', html_url: 'https://evil.example/x' }), null)
  assert.equal(parseRelease({ tag_name: 'v1.0.0' }), null)
})

test('checkForUpdate: newer, same, no release yet, network failure', async () => {
  configureFetch(reply(200, release))
  assert.deepEqual(await checkForUpdate('1.1.0'), {
    current: '1.1.0',
    latest: { version: '1.2.0', url: release.html_url }
  })
  assert.equal((await checkForUpdate('1.2.0')).latest, null)
  configureFetch(reply(404, { message: 'Not Found' }))
  assert.equal((await checkForUpdate('1.0.0')).latest, null)
  configureFetch(async () => {
    throw new Error('offline')
  })
  await assert.rejects(checkForUpdate('1.0.0'), /offline/)
})
