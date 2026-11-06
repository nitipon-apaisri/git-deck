import * as Progress from '@radix-ui/react-progress'

interface ProgressBarProps {
  /** 0 to 100. `null` shows a moving bar for work that reports no percentage. */
  percent: number | null
  label: string
}

/** shadcn's progress on Radix. */
export function ProgressBar({ percent, label }: ProgressBarProps) {
  const value = percent === null ? null : Math.min(100, Math.max(0, Math.round(percent)))
  return (
    <Progress.Root
      value={value}
      aria-label={label}
      className="h-1.5 overflow-hidden rounded-[var(--radius-xs)] bg-[var(--neutral)]"
    >
      <Progress.Indicator
        className="h-full rounded-[inherit] bg-[var(--accent)] transition-[width] duration-150 ease-out data-[state=indeterminate]:w-[35%] data-[state=indeterminate]:animate-progress-slide motion-reduce:transition-none motion-reduce:data-[state=indeterminate]:w-full motion-reduce:data-[state=indeterminate]:animate-none motion-reduce:data-[state=indeterminate]:opacity-50"
        style={value === null ? undefined : { width: `${value}%` }}
      />
    </Progress.Root>
  )
}
