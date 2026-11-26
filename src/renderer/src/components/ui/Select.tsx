import { useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Menu } from './Menu'

export interface SelectOption {
  value: string
  label: string
  /** A logo or glyph before the label. */
  leading?: ReactNode
}

interface SelectProps {
  options: readonly SelectOption[]
  value: string
  onChange: (value: string) => void
  id: string
  disabled?: boolean
}

/** A button with the TextInput look that opens the house `Menu` under it, so it matches the other dropdowns. */
export function Select({ options, value, onChange, id, disabled }: SelectProps) {
  const button = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; width: number } | null>(null)
  const current = options.find((o) => o.value === value)

  const open = (): void => {
    const r = button.current?.getBoundingClientRect()
    if (r) setAt({ x: r.left, y: r.bottom + 4, width: r.width })
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={at !== null}
        onClick={open}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md bg-secondary pr-3 pl-3 text-left text-[13px] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {current?.leading}
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ''}</span>
        <span className="flex-none text-muted-foreground">
          <Icon name="chevron-down" size="sm" />
        </span>
      </button>
      {at ? (
        <Menu
          label="Choose an option"
          at={at}
          minWidth={at.width}
          searchable={options.length > 8}
          entries={options.map((o) => ({
            kind: 'item' as const,
            id: o.value,
            label: o.label,
            leading: o.leading,
            checked: o.value === value,
            radio: true,
            onSelect: () => onChange(o.value)
          }))}
          onClose={() => setAt(null)}
        />
      ) : null}
    </>
  )
}
