import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { configureFetch, countItems, getJson, HttpError, paginate, parseLink } from '../src/main/http'

let server: http.Server
let base = ''

before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x')
    const page = Number(u.searchParams.get('page') ?? '1')
    const json = (body: unknown, headers: Record<string, string> = {}, status = 200): void => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers })
      res.end(JSON.stringify(body))
    }
    switch (u.pathname) {
      case '/pages':
        return json([page * 10, page * 10 + 1], page < 3 ? { link: `<${base}/pages?page=${page + 1}>; rel="next"` } : {})
      case '/total':
        return json([1], { 'x-total': '42' })
      case '/last':
        return json([1], {
          link: `<${base}/last?page=2&per_page=1>; rel="next", <${base}/last?page=57&per_page=1>; rel="last"`
        })
      case '/nextonly':
        return json([1], { link: `<${base}/nextonly?page=2>; rel="next"` })
      case '/plain':
        return json([1, 2, 3])
      case '/empty':
        res.writeHead(200)
        return void res.end()
      case '/nocontent':
        res.writeHead(204)
        return void res.end()
      case '/forbidden':
        return json({ message: 'nope' }, {}, 403)
      case '/hang':
        return
      default:
        return json({ ok: true })
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => {
  server.closeAllConnections()
  server.close()
})

describe('parseLink', () => {
  it('extracts next and last', () => {
    assert.deepEqual(parseLink('<https://a/?page=2>; rel="next", <https://a/?page=9>; rel="last"'), {
      next: 'https://a/?page=2',
      last: 'https://a/?page=9'
    })
  })
  it('handles missing and empty headers', () => {
    assert.deepEqual(parseLink(null), {})
    assert.deepEqual(parseLink(''), {})
    assert.deepEqual(parseLink('<https://a/?page=1>; rel="prev"'), {})
  })
})

describe('getJson', () => {
  it('parses JSON, empty bodies and 204', async () => {
    assert.deepEqual(await getJson(`${base}/x`), { ok: true })
    assert.equal(await getJson(`${base}/empty`), null)
    assert.equal(await getJson(`${base}/nocontent`), null)
  })
  it('throws HttpError with status and server message', async () => {
    await assert.rejects(getJson(`${base}/forbidden`), (e) => {
      assert.ok(e instanceof HttpError)
      assert.equal(e.status, 403)
      assert.match(e.message, /nope/)
      return true
    })
  })
  it('times out via the injected fetch', async () => {
    configureFetch(() => Promise.reject(Object.assign(new Error('t'), { name: 'TimeoutError' })))
    await assert.rejects(getJson(`${base}/hang`), /timed out/)
    configureFetch((i, init) => fetch(i, init))
  })
})

describe('paginate', () => {
  it('follows rel=next', async () => {
    assert.deepEqual(await paginate<number>(`${base}/pages`), [10, 11, 20, 21, 30, 31])
  })
})

describe('countItems', () => {
  it('prefers x-total', async () => assert.equal(await countItems(`${base}/total`), 42))
  it('falls back to rel=last page', async () => assert.equal(await countItems(`${base}/last`), 57))
  it('returns null when only next is known', async () => assert.equal(await countItems(`${base}/nextonly`), null))
  it('falls back to array length', async () => assert.equal(await countItems(`${base}/plain`), 3))
})
