import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

interface ControlProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
}

interface FieldProps {
  label: string
  /** Help under the input. Scopes, paths and URLs inside use `<code>`. */
  hint?: ReactNode
  /** Said in words, never by colour alone. */
  error?: string | null
  /** Sits beside the label, for an inline action such as "Create token". */
  action?: ReactNode
  /** Receives the props that tie the control to its label and messages. */
  children: (control: ControlProps) => ReactNode
}

export function Field({ label, hint, error, action, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-4.5 items-center justify-between">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {action}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="flex items-start gap-2 text-xs leading-4 text-destructive"
        >
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : null}
      {hint ? (
        <span
          id={hintId}
          className="text-xs leading-4 text-muted-foreground [&_code]:font-mono [&_code]:text-xs"
        >
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 min-w-0 rounded-md border border-(--border-strong) bg-secondary px-3 text-[13px] text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...rest}
    />
  )
}

interface CheckOptionProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Plain, specific warning shown with the alert icon. */
  warning?: ReactNode
}

/** A related option in its own `radius-lg` box, with its warning below. */
export function CheckOption({ label, checked, onChange, warning }: CheckOptionProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary p-3">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 font-medium">
        <Checkbox.Root
          id={id}
          checked={checked}
          onCheckedChange={(next) => onChange(next === true)}
          className="grid size-4 flex-none cursor-pointer place-items-center rounded-[4px] border border-(--border-strong) bg-transparent text-primary-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary"
        >
          <Checkbox.Indicator>
            <Icon name="check" size="sm" />
          </Checkbox.Indicator>
        </Checkbox.Root>
        {label}
      </label>
      {warning ? (
        <span className="flex gap-2 text-xs leading-4 text-(--warning-text)">
          <span className="mt-px">
            <Icon name="alert" size="sm" />
          </span>
          <span>{warning}</span>
        </span>
      ) : null}
    </div>
  )
}
