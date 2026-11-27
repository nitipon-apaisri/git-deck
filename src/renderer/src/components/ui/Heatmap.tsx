import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { heatCells, heatTip, monthLabels, type HeatDay } from '../../lib/profileView'
import { cn } from '@/lib/cn'

const HEAT = ['bg-(--hover)', 'bg-(--heat-1)', 'bg-(--heat-2)', 'bg-(--heat-3)', 'bg-(--heat-4)']

interface HeatmapProps {
  /** Oldest first. */
  days: readonly HeatDay[]
  /** Singular, for the tooltip: "commit", "contribution". */
  noun: string
  /** The grid's accessible name. */
  label: string
}

/** A week-column day grid with month labels, a hover tooltip and a Less/More legend. Scrolls sideways when narrow. */
export function Heatmap({ days, noun, label }: HeatmapProps) {
  const cells = useMemo(() => heatCells(days), [days])
  const months = useMemo(() => monthLabels(cells), [cells])
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // A narrow box shows the latest weeks first, also after a resize; the rest is a sideways scroll away.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const toEnd = (): void => {
      el.scrollLeft = el.scrollWidth
    }
    toEnd()
    const observer = new ResizeObserver(toEnd)
    observer.observe(el)
    return () => observer.disconnect()
  }, [cells])

  return (
    <div className="min-w-0">
      <div
        ref={scroller}
        className="overflow-x-auto pb-1"
        // Focusable so a narrow heatmap scrolls with the arrow keys.
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <div className="w-max">
          <div className="flex w-max gap-2">
            <div
              aria-hidden="true"
              className="grid grid-rows-[11px_repeat(7,11px)] gap-0.75 pr-1 text-[10px] leading-2.75 text-muted-foreground"
            >
              <span />
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            <div className="flex flex-col gap-0.75">
              <div
                aria-hidden="true"
                className="grid h-2.75 auto-cols-[11px] grid-flow-col gap-0.75 text-[10px] leading-2.75 text-muted-foreground"
              >
                {months.map((m) => (
                  <span key={m.col} style={{ gridColumnStart: m.col + 1 }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div
                role="img"
                aria-label={label}
                className="grid w-max auto-cols-[11px] grid-flow-col grid-rows-[repeat(7,11px)] gap-0.75"
              >
                {cells.map((c, i) =>
                  c ? (
                    <div
                      key={c.date}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setTip({
                          text: heatTip(c.count, c.date, noun),
                          x: r.left + r.width / 2,
                          y: r.top
                        })
                      }}
                      onMouseLeave={() => setTip(null)}
                      className={cn('size-2.75 rounded-[2px]', HEAT[c.level])}
                    />
                  ) : (
                    <div key={`pad-${i}`} className="size-2.75" />
                  )
                )}
              </div>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground"
          >
            Less
            {HEAT.map((h) => (
              <span key={h} className={cn('size-2.75 rounded-[2px]', h)} />
            ))}
            More
          </div>
        </div>
      </div>
      {tip ? (
        <div
          role="tooltip"
          style={{ left: tip.x, top: tip.y - 6 }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-(--island-raised) px-2 py-1 text-[12px] leading-4 whitespace-nowrap text-foreground shadow-(--shadow-menu)"
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  )
}
