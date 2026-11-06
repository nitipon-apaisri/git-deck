import { useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import {
  DIVIDER,
  effectiveOrientation,
  fitRatio,
  minPane,
  nudgeRatio,
  ratioFromPointer,
  trackTemplate
} from '../../lib/splitLayout'
import { RATIO_MAX, RATIO_MIN, type Orientation } from '../../lib/splitState'
import { useElementSize } from '../../state/useElementSize'

interface SplitViewProps {
  /** Two panes with a divider. Off shows only `first`. */
  enabled: boolean
  /** The saved orientation. Side by side stacks by itself when the area is too narrow. */
  orientation: Orientation
  /** Size of the first pane as a share, 0.25 to 0.75. */
  ratio: number
  onRatioChange: (ratio: number) => void
  /** The panes. Give each a `key` so a swap moves it instead of rebuilding it. */
  first: ReactNode
  second: ReactNode
}

/**
 * The layout of one or two panes. It knows nothing about repositories: the caller builds
 * the panes. A CSS grid keeps the minimum sizes and reflows with the window, and the
 * divider is a separator that can be dragged, nudged with the arrow keys or reset.
 */
export function SplitView({
  enabled,
  orientation: saved,
  ratio,
  onRatioChange,
  first,
  second
}: SplitViewProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>()
  const [dragging, setDragging] = useState(false)

  const orientation = effectiveOrientation(saved, width)
  const horizontal = orientation === 'horizontal'
  const extent = horizontal ? width : height
  const min = minPane(orientation)
  // The ratio on screen: the saved one, held inside the minimum sizes.
  const shown = extent > 0 ? fitRatio(ratio, extent, min) : ratio

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const area = ref.current
    if (!dragging || !area) return
    const rect = area.getBoundingClientRect()
    onRatioChange(
      horizontal
        ? ratioFromPointer(event.clientX, rect.left, rect.width, min)
        : ratioFromPointer(event.clientY, rect.top, rect.height, min)
    )
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const back = horizontal ? 'ArrowLeft' : 'ArrowUp'
    const forward = horizontal ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== back && event.key !== forward) return
    event.preventDefault()
    onRatioChange(fitRatio(nudgeRatio(shown, event.key === forward ? 1 : -1), extent, min))
  }

  const template = enabled ? trackTemplate(shown, orientation) : undefined
  return (
    <div
      ref={ref}
      className={[
        'group/split grid min-h-0 min-w-0 flex-1 [grid-template:minmax(0,1fr)/minmax(0,1fr)]',
        'data-[dragging=true]:select-none data-[dragging=true]:data-[orientation=horizontal]:cursor-col-resize data-[dragging=true]:data-[orientation=vertical]:cursor-row-resize',
        // Every pane keeps room for the active outline, and shows it only in split view.
        '[&>[data-pane]]:min-h-0 [&>[data-pane]]:min-w-0 [&>[data-pane]]:outline-2 [&>[data-pane]]:-outline-offset-2 [&>[data-pane]]:outline-transparent',
        'data-[multi=true]:[&>[data-pane][data-active=true]]:outline-[var(--accent)]'
      ].join(' ')}
      data-multi={enabled}
      data-orientation={orientation}
      data-dragging={dragging ? 'true' : undefined}
      style={
        template
          ? horizontal
            ? { gridTemplateColumns: template, gridTemplateRows: 'minmax(0, 1fr)' }
            : { gridTemplateRows: template, gridTemplateColumns: 'minmax(0, 1fr)' }
          : undefined
      }
    >
      {first}
      {enabled ? (
        <div
          key="divider"
          className="group/divider relative grid touch-none place-items-center rounded-md focus-visible:-outline-offset-2 group-data-[orientation=horizontal]/split:cursor-col-resize group-data-[orientation=vertical]/split:cursor-row-resize"
          role="separator"
          aria-label="Resize panes"
          aria-orientation={horizontal ? 'vertical' : 'horizontal'}
          aria-valuenow={Math.round(shown * 100)}
          aria-valuemin={Math.round(RATIO_MIN * 100)}
          aria-valuemax={Math.round(RATIO_MAX * 100)}
          aria-valuetext={`First pane ${Math.round(shown * 100)} percent`}
          tabIndex={0}
          style={{ [horizontal ? 'width' : 'height']: DIVIDER }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onDoubleClick={() => onRatioChange(0.5)}
        >
          <span
            className="rounded-[var(--radius-xs)] bg-[var(--border-strong)] opacity-55 transition-opacity duration-[120ms] group-hover/divider:bg-[var(--accent)] group-hover/divider:opacity-100 group-focus-visible/divider:bg-[var(--accent)] group-focus-visible/divider:opacity-100 group-data-[dragging=true]/split:bg-[var(--accent)] group-data-[dragging=true]/split:opacity-100 group-data-[orientation=horizontal]/split:h-10 group-data-[orientation=horizontal]/split:w-[3px] group-data-[orientation=vertical]/split:h-[3px] group-data-[orientation=vertical]/split:w-10"
            aria-hidden="true"
          />
        </div>
      ) : null}
      {enabled ? second : null}
    </div>
  )
}
