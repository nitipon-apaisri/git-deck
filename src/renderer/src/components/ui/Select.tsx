import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: readonly SelectOption[]
  value: string
  onChange: (value: string) => void
  id: string
  disabled?: boolean
}

/** No house select exists yet: a native one with the TextInput look. */
export function Select({ options, value, onChange, ...rest }: SelectProps) {
  return (
    <div className="relative flex">
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 flex-1 cursor-pointer appearance-none truncate rounded-md border border-(--border-strong) bg-secondary pr-9 pl-3 text-[13px] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
        <Icon name="chevron-down" size="sm" />
      </span>
    </div>
  )
}
