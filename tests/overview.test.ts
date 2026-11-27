import assert from 'node:assert/strict'
import { symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { commitDays, readReadme } from '../src/main/git'
import { capReadme, countDates, fillDays, MAX_README_BYTES } from '../src/shared/overview'
import { renderMarkdown } from '../src/renderer/src/lib/markdown'
import { activityStats } from '../src/renderer/src/lib/repoView'
import { commit, emptyRepo, tempDir } from './helpers'

test('readReadme: any case, .md preferred, missing is null, oversize is cut', () => {
  const dir = tempDir()
  assert.equal(readReadme(dir), null)
  assert.equal(readReadme(join(dir, 'gone')), null)
  writeFileSync(join(dir, 'readme.txt'), 'plain')
  writeFileSync(join(dir, 'ReadMe.MD'), '# md')
  writeFileSync(join(dir, 'README-old.md'), 'not a readme')
  assert.deepEqual(readReadme(dir), { name: 'ReadMe.MD', markdown: '# md', truncated: false })

  const big = tempDir()
  writeFileSync(join(big, 'README.md'), 'x'.repeat(MAX_README_BYTES + 10))
  const cut = readReadme(big)
  assert.equal(cut?.truncated, true)
  assert.equal(cut?.markdown.length, MAX_README_BYTES)
})

test('readReadme: a symlinked README is not followed', () => {
  const outside = tempDir()
  writeFileSync(join(outside, 'secret.txt'), 'secret')
  const dir = tempDir()
  symlinkSync(join(outside, 'secret.txt'), join(dir, 'README.md'))
  assert.equal(readReadme(dir), null)
})

test('commitDays: every day of 12 months, counts per day, an empty repo is zeros', async () => {
  const empty = emptyRepo()
  const none = await commitDays(empty)
  assert.equal(none.length, 365)
  assert.ok(none.every((d) => d.count === 0))
  commit(empty, 'a.txt', 'one')
  commit(empty, 'b.txt', 'two')
  const days = await commitDays(empty)
  assert.equal(days.at(-1)?.count, 2)
})

test('fillDays and countDates: oldest first, ending today, bad dates ignored', () => {
  const now = new Date(2026, 10, 27, 15)
  const days = fillDays(
    countDates(['2026-11-27T01:00:00Z', '2026-11-27', 'junk', '2025-11-28']),
    now
  )
  assert.equal(days.length, 365)
  assert.deepEqual(days[0], { date: '2025-11-28', count: 1 })
  assert.deepEqual(days.at(-1), { date: '2026-11-27', count: 2 })
})

test('capReadme: cuts on UTF-8 bytes', () => {
  assert.deepEqual(capReadme('short'), { markdown: 'short', truncated: false })
  const cut = capReadme('é'.repeat(MAX_README_BYTES))
  assert.equal(cut.truncated, true)
  assert.ok(new TextEncoder().encode(cut.markdown).length <= MAX_README_BYTES + 2)
})

test('activityStats: totals, active days, busiest weekday and the current streak', () => {
  const day = (date: string, count: number) => ({ date, count })
  // 2026-11-23 is a Monday.
  const s = activityStats([
    day('2026-11-22', 0),
    day('2026-11-23', 5),
    day('2026-11-24', 1),
    day('2026-11-25', 0),
    day('2026-11-26', 2),
    day('2026-11-27', 1)
  ])
  assert.deepEqual(s, { commits: 9, activeDays: 4, busiestDay: 'Monday', streak: 2 })
  // Today with no commit yet keeps yesterday's streak.
  assert.equal(activityStats([day('2026-11-26', 1), day('2026-11-27', 0)]).streak, 1)
  assert.deepEqual(activityStats([]), { commits: 0, activeDays: 0, busiestDay: null, streak: 0 })
})

test('renderMarkdown: drops scripts, handlers and raw HTML; https links and images only', () => {
  const html = renderMarkdown(
    [
      '# Title',
      '<script>alert(1)</script>',
      '',
      '<img src="https://x.example/a.png" onerror="alert(1)">',
      '<p align="center">centred</p>',
      '',
      '[bad](javascript:alert(1)) [rel](docs/a.md) [ok](https://example.com "T")',
      '',
      '![logo](docs/logo.png) ![remote](https://img.example/b.png)',
      '',
      '![data](data:image/png;base64,AAAA)',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | <b>2</b> |',
      '',
      '```ts',
      'const x = "<tag>"',
      '```'
    ].join('\n')
  )
  assert.doesNotMatch(html, /<script|onerror|javascript:|align=|data:image/i)
  assert.match(html, /<h2>Title<\/h2>/, 'headings move one level down')
  assert.match(html, /bad rel <a href="https:\/\/example\.com\/" title="T">ok<\/a>/)
  assert.match(html, /<span class="md-image-placeholder">Image: logo<\/span>/)
  assert.match(html, /<img src="https:\/\/img\.example\/b\.png" alt="remote"/)
  assert.match(html, /<table>[\s\S]*<td>1<\/td>/)
  assert.match(html, /&lt;tag&gt;/)
})
