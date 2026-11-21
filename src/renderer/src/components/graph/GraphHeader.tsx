import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

export const MIN_REFS = 96
export const MIN_GRAPH = 72
export const MAX_COL = 480

interface ResizeProps {
  label: string
  width: number
  min: number
  onChange: (width: number) => void
}

const clamp = (w: number, min: number): number => Math.min(MAX_COL, Math.max(min, Math.round(w)))

/** A draggable divider on the right edge of a header cell; arrow keys nudge it. */
function Handle({ label, width, min, onChange }: ResizeProps) {
  const drag = useRef<{ x: number; w: number } | null>(null)
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={MAX_COL}
      tabIndex={0}
      className="group absolute inset-y-0 -right-2 z-10 flex w-3 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none"
      onPointerDown={(event: PointerEvent<HTMLSpanElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, w: width }
      }}
      onPointerMove={(event) => {
        if (drag.current) onChange(clamp(drag.current.w + event.clientX - drag.current.x, min))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        onChange(clamp(width + (event.key === 'ArrowRight' ? 16 : -16), min))
      }}
    >
      {/* Always drawn, so the column edge reads as draggable. */}
      <span className="h-4 w-0.5 rounded-full bg-muted-foreground/50 transition-[background-color] duration-(--motion-fast) group-hover:bg-(--accent-text) group-focus-visible:bg-(--accent-text)" />
    </span>
  )
}

// No overflow clipping here: the divider sits half outside the cell, in the gap.
const cell = 'relative flex-none'

interface GraphHeaderProps {
  refsWidth: number
  graphWidth: number
  /** No author or date column, as in the rows. */
  compact: boolean
  onRefsWidth: (width: number) => void
  onGraphWidth: (width: number) => void
}

/** Column titles over the commit rows. It repeats the row's gaps and widths so they line up. */
export function GraphHeader({
  refsWidth,
  graphWidth,
  compact,
  onRefsWidth,
  onGraphWidth
}: GraphHeaderProps) {
  return (
    <div className="flex h-7 flex-none items-center gap-2 rounded-md bg-muted pr-3 pl-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase select-none">
      <span className={cell} style={{ width: refsWidth }}>
        <span className="block truncate">Branch / tag</span>
        <Handle label="branch / tag" min={MIN_REFS} width={refsWidth} onChange={onRefsWidth} />
      </span>
      <span className={cell} style={{ width: graphWidth }}>
        <span className="block truncate">Graph</span>
        <Handle label="graph" min={MIN_GRAPH} width={graphWidth} onChange={onGraphWidth} />
      </span>
      <span className="min-w-0 flex-[1_0_12ch] truncate">Commit message</span>
      {compact ? null : (
        <>
          <span className="w-32 flex-none truncate">Author</span>
          <span className="w-19 flex-none truncate">Date</span>
        </>
      )}
      <span className="w-14 flex-none truncate">SHA</span>
    </div>
  )
}
