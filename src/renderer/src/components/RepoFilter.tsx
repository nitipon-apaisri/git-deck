import { Icon } from './ui'

interface RepoFilterProps {
  value: string
  onChange: (value: string) => void
  /** A project is the active scope, so the filter works inside it. */
  scoped: boolean
}

/** The repository filter in the toolbar. Escape clears it, and a second Escape leaves the field. */
export function RepoFilter({ value, onChange, scoped }: RepoFilterProps) {
  return (
    <label className="flex h-8 w-full min-w-0 flex-none items-center gap-2.5 rounded-md border border-[var(--border-strong)] px-3 text-[14px] text-muted-foreground">
      <Icon name="search" />
      <input
        type="search"
        className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-0 placeholder:text-muted-foreground"
        data-search-input
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          if (value !== '') onChange('')
          else e.currentTarget.blur()
        }}
        aria-label={scoped ? 'Filter repositories in this project' : 'Filter repositories'}
        placeholder={scoped ? 'Filter in project' : 'Filter repositories'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
