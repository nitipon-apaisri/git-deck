/** Caps how many async jobs run at once; the rest wait in order. */
export class Semaphore {
  private active = 0
  private readonly waiting: (() => void)[] = []

  constructor(private readonly limit: number) {}

  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve))
    else this.active++
    try {
      return await job()
    } finally {
      const next = this.waiting.shift()
      // Hand the slot straight to the next waiter, so `active` stays accurate.
      if (next) next()
      else this.active--
    }
  }
}
