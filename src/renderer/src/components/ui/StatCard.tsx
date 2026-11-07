import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

const LABEL = 'text-[12px] leading-4 text-muted-foreground'

interface StatCardProps {
  /** `null` means the host could not be reached: shown as "Unavailable", never 0. */
  value: string | number | null
  label: string
  /** The figure adds only known counts. */
  partial?: boolean
  /** The value is an estimate and is shown with a leading "~". */
  approximate?: boolean
  /** A quiet line under the label, for example "on 3 hosts". */
  note?: string
  /** Why the figure is partial or approximate, as a tooltip. */
  explain?: string
  /** The figure is on its way: a placeholder shows in its place. */
  loading?: boolean
}

export function StatCard({
  value,
  label,
  partial = false,
  approximate = false,
  note,
  explain,
  loading = false
}: StatCardProps) {
  return (
    <div
      className="flex flex-col items-start gap-0.5 rounded-xl bg-secondary px-3.5 py-3"
      title={explain}
    >
      {loading ? (
        <span className="flex h-7.5 items-center">
          <Skeleton width={64} height={24} label={`Loading ${label}`} />
        </span>
      ) : value === null ? (
        <span className="text-[15px] leading-7.5 text-muted-foreground">Unavailable</span>
      ) : (
        <span className="text-[24px] leading-7.5 font-semibold text-foreground">
          {approximate ? '~' : ''}
          {value}
        </span>
      )}
      <span className={LABEL}>{label}</span>
      {note ? <span className={LABEL}>{note}</span> : null}
      {partial ? (
        <span className="mt-1 inline-flex items-center gap-1 rounded-(--radius-xs) bg-(--warning-bg) px-2 text-[11.5px] leading-4.5 font-medium text-(--warning-text)">
          <Icon name="alert" size="xs" />
          Partial
        </span>
      ) : null}
    </div>
  )
}
