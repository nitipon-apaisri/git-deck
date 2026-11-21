import { cn } from '@/lib/cn'
import type { CheckState } from '@shared/types'
import { CHECK_LABEL } from '../../lib/changeView'

const TONE: Record<CheckState, string> = {
  success: 'bg-(--success)',
  failure: 'bg-(--danger)',
  pending: 'bg-(--warning-text)',
  none: 'bg-transparent border border-border'
}

/** CI state as a dot. The title and the hidden text name it, so colour is not the only cue. */
export function CheckDot({ state, className }: { state: CheckState; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2 flex-none rounded-full', TONE[state], className)}
      title={CHECK_LABEL[state]}
      role="img"
      aria-label={CHECK_LABEL[state]}
    />
  )
}
