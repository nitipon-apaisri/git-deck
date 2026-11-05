import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Field.module.css'

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
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {action}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <span id={errorId} role="alert" className={styles.error}>
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : null}
      {hint ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.input} ${className ?? ''}`} {...rest} />
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
  return (
    <div className={styles.optionBox}>
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {warning ? (
        <span className={styles.warning}>
          <Icon name="alert" size="sm" />
          <span>{warning}</span>
        </span>
      ) : null}
    </div>
  )
}
