import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './ChoiceGroup.module.css'

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

/** One choice out of a few, as cards. A radio group: arrow keys move the choice. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 2
}: ChoiceGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number): void {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${styles.group} ${columns === 3 ? styles.three : ''}`}
    >
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`${styles.choice} ${checked ? styles.checked : ''}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {option.leading}
            <span className={styles.text}>
              <span className={styles.title}>{option.title}</span>
              {option.sub ? <span className={styles.sub}>{option.sub}</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
