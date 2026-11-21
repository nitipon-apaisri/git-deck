// Parser for the `BISECT_LOG` file. No electron import, so it runs under tsx tests.
import type { BisectState } from './types'

type Parsed = Omit<BisectState, 'current'>

/** Reads the marks and the final "first bad commit" line git appends to the log. */
export function parseBisectLog(text: string): Parsed {
  const out: Parsed = { bad: null, good: [], skipped: [], result: null }
  for (const line of text.split('\n')) {
    const mark = /^git bisect (bad|good|skip) ([0-9a-f]{7,64})\b/.exec(line)
    if (mark) {
      const [, term, hash] = mark
      if (term === 'bad') out.bad = hash
      else if (term === 'good') out.good.push(hash)
      else out.skipped.push(hash)
      continue
    }
    const first = /^# first bad commit: \[([0-9a-f]{7,64})\] (.*)$/.exec(line)
    if (first) out.result = { hash: first[1], subject: first[2] }
  }
  return out
}
