import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { countItems, getJson, HttpError, paginate, parseLink } from '../src/main/http'

let server: Server
let base = ''
let lastAuth: string | undefined

before(async () => {
  server = createServer((req, res) => {
    lastAuth = req.headers['authorization']
    const url = new URL(req.url!, base)
    const page = Number(url.searchParams.get('page') ?? '1')
    const json = (code: number, body: unknown, headers: Record<string, string> = {}): void => {
      res.writeHead(code, { 'content-type': 'application/json', ...headers })
      res.end(JSON.stringify(body))
    }
    switch (url.pathname) {
      case '/pages': {
        const link: Record<string, string> =
          page < 3 ? { link: `<${base}/pages?page=${page + 1}>; rel="next"` } : {}
        return json(200, [page * 10, page * 10 + 1], link)
      }
      case '/loop':
        return json(200, [1], { link: `<${base}/loop>; rel="next"` })
      case '/total':
        return json(200, [1], { 'x-total': '42' })
      case '/last':
        return json(200, [1], {
          link: `<${base}/last?per_page=1&page=7>; rel="next", <${base}/last?per_page=1&page=7>; rel="last"`
        })
      case '/unknown':
        return json(200, [1], { link: `<${base}/unknown?page=2>; rel="next"` })
      case '/short':
        return json(200, [])
      case '/empty':
        res.writeHead(200)
        return void res.end()
      case '/nocontent':
        res.writeHead(204)
        return void res.end()
      case '/bad':
        res.writeHead(200)
        return void res.end('{oops')
      case '/missing':
        return json(404, { message: 'nope' })
      default:
        return json(200, { ok: true })
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => server.close())

test('parseLink extracts next and last', () => {
  assert.deepEqual(
    parseLink('<https://a/x?page=2>; rel="next", <https://a/x?page=9>; rel="last"'),
    {
      next: 'https://a/x?page=2',
      last: 'https://a/x?page=9'
    }
  )
  assert.deepEqual(parseLink(null), { next: null, last: null })
  assert.deepEqual(parseLink('<https://a>; rel="prev"'), { next: null, last: null })
})

test('getJson parses JSON, sends headers, tolerates empty and 204', async () => {
  assert.deepEqual(await getJson(`${base}/ok`, { authorization: 'Bearer t' }), { ok: true })
  assert.equal(lastAuth, 'Bearer t')
  assert.equal(await getJson(`${base}/empty`), null)
  assert.equal(await getJson(`${base}/nocontent`), null)
})

test('getJson throws HttpError without leaking the token', async () => {
  await assert.rejects(getJson(`${base}/missing`, { authorization: 'Bearer SECRET' }), (e) => {
    assert.ok(e instanceof HttpError)
    assert.equal(e.status, 404)
    assert.ok(!e.message.includes('SECRET'))
    return true
  })
  await assert.rejects(getJson(`${base}/bad`), HttpError)
})

test('paginate follows rel=next', async () => {
  assert.deepEqual(await paginate<number>(`${base}/pages`), [10, 11, 20, 21, 30, 31])
})

test('paginate stops at 100 pages', async () => {
  assert.equal((await paginate<number>(`${base}/loop`)).length, 100)
})

test('countItems uses x-total, then the last page, then length, else null', async () => {
  assert.equal(await countItems(`${base}/total`), 42)
  assert.equal(await countItems(`${base}/last`), 7)
  assert.equal(await countItems(`${base}/short`), 0)
  assert.equal(await countItems(`${base}/unknown`), null)
})
