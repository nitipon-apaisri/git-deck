import type { GitProgress } from '@shared/api'
import { activityLabel } from '../../lib/operationView'
import type { LocalBusy } from '../../state/useLocalActions'
import { Icon, ProgressBar } from '../ui'

interface ActivityIndicatorProps {
  busy: LocalBusy
  /** Git's latest output line for this repository, while a clone, pull or push runs. */
  progress: GitProgress | null
  /** The confirmation of the write that just ended. */
  done: { id: number; text: string } | null
}

/** What this pane's git write is doing, then a short confirmation. Nothing when idle. */
export function ActivityIndicator({ busy, progress, done }: ActivityIndicatorProps) {
  if (busy !== null) {
    const label = activityLabel(busy)
    return (
      <div className="flex min-h-9 w-56 min-w-0 flex-col justify-center gap-1 rounded-md bg-(--neutral) px-3 py-1.5">
        {/* Screen readers hear the label once, not every output line git prints. */}
        <span className="sr-only" role="status">
          {label}
        </span>
        <p
          className="m-0 truncate text-[12px] leading-4 text-(--text)"
          title={progress?.line}
          aria-hidden="true"
        >
          {progress?.line ?? label}
        </p>
        <div aria-hidden="true">
          <ProgressBar percent={progress?.percent ?? null} label={label} />
        </div>
      </div>
    )
  }
  if (done) {
    return (
      <div
        // A new `id` restarts the fade when two writes end close together.
        key={done.id}
        className="flex min-h-9 animate-activity-done items-center gap-2 rounded-md bg-(--success-bg) px-3 text-(--success-text) motion-reduce:animate-none"
        role="status"
      >
        <Icon name="check" size="sm" />
        <span className="truncate">{done.text}</span>
      </div>
    )
  }
  return null
}
