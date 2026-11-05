import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** One primary button per screen. Ghost is for inline actions beside a field. */
  variant?: 'default' | 'primary' | 'ghost'
  icon?: IconName
}

export function Button({
  variant = 'default',
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className ?? ''].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </button>
  )
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: an icon alone has no name. Also used as the tooltip. */
  label: string
  icon: IconName
  /** `rail` is the 36px button of the icon rail. */
  size?: 'md' | 'rail'
  /** Marks the current section (accent glyph on an island tile). */
  active?: boolean
}

export function IconButton({
  label,
  icon,
  size = 'md',
  active = false,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  const classes = [
    styles.iconButton,
    size === 'rail' ? styles.rail : '',
    active ? styles.active : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  )
}
