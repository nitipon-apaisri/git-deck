import type { ReactNode } from 'react'
import { RadioGroup } from 'radix-ui'
import { cn } from '@/lib/cn'

export interface Choice<T extends string> {
  value: T
  title: string
  sub?: string
  leading?: ReactNode
}

interface ChoiceGroupProps<T extends string> {
  label: string
  value: T
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  columns?: 2 | 3
}

/** One choice out of a few, as cards. shadcn's radio group on Radix: arrow keys move the choice. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 2
}: ChoiceGroupProps<T>) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          className="flex min-h-[54px] min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-transparent px-3 text-left text-[13px] text-foreground transition-[background-color,border-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-accent data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--selection)]"
        >
          {option.leading}
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">{option.title}</span>
            {option.sub ? (
              <span className="text-[12px] text-muted-foreground">{option.sub}</span>
            ) : null}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
