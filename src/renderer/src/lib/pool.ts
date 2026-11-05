// Runs async work with a fixed number of tasks at a time. No DOM, so it runs under tsx.

export interface PoolOptions<T> {
  /** At most this many `work` calls at once (at least 1). */
  limit: number
  /** Called after each item settles, in completion order. */
  onSettled?: (item: T, error: unknown | null, done: number) => void
  /** Stops starting new items once it returns true. Items already running finish. */
  cancelled?: () => boolean
}

/**
 * Starts items in order and keeps `limit` running. One item failing never stops the
 * others: its error goes to `onSettled`, and the pool resolves when all have settled.
 */
export async function runPool<T>(
  items: readonly T[],
  work: (item: T) => Promise<void>,
  { limit, onSettled, cancelled }: PoolOptions<T>
): Promise<void> {
  let next = 0
  let done = 0
  const width = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))

  async function worker(): Promise<void> {
    while (next < items.length && !cancelled?.()) {
      const item = items[next++]
      let failure: unknown | null = null
      try {
        await work(item)
      } catch (err) {
        failure = err ?? new Error('Failed')
      }
      done += 1
      onSettled?.(item, failure, done)
    }
  }

  await Promise.all(Array.from({ length: width }, worker))
}
