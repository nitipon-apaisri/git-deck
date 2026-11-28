import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import type { ButtonActivity } from '../../lib/operationView'
import { Icon, type IconName } from './Icon'

// shadcn's button, with our variant names: `default` is the outlined button, `primary` the filled
// one (shadcn calls it `default`), `ghost` the inline action beside a field.
/**
 * The icon of a button that runs a write: a spinner while it runs, then a green check or a red
 * cross. Only the icon takes the colour. `idle` shows the button's own icon.
 */
function ActivityIcon({
  activity,
  icon,
  size
}: {
  activity: ButtonActivity | undefined
  icon: IconName
  size: 'md' | 'sm'
}) {
  if (activity === 'busy') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-block flex-none animate-spin rounded-full border-2 border-border border-t-(--accent) motion-reduce:animate-none motion-reduce:border-r-(--accent)',
          size === 'md' ? 'size-(--icon-size)' : 'size-(--icon-size-sm)'
        )}
      />
    )
  }
  if (activity === 'success' || activity === 'error') {
    return (
      <span className={activity === 'success' ? 'text-(--success)' : 'text-(--danger)'}>
        <Icon name={activity === 'success' ? 'check' : 'x'} size={size} />
      </span>
    )
  }
  return <Icon name={icon} size={size} />
}

const buttonVariants = cva(
  'inline-flex h-9 cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-md px-4 text-[13px] leading-4.5 transition-[background-color,color,transform] duration-(--motion-fast) ease-(--ease-out) active:scale-[0.97] disabled:cursor-default disabled:opacity-45 disabled:active:scale-100',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-foreground hover:bg-accent disabled:hover:bg-secondary',
        primary:
          'bg-primary font-medium text-primary-foreground hover:brightness-110 disabled:hover:brightness-100',
        danger:
          'bg-destructive font-medium text-(--window) hover:brightness-110 disabled:hover:brightness-100',
        'danger-soft':
          'bg-(--danger-bg) font-medium text-(--danger-text) hover:brightness-125 disabled:hover:brightness-100',
        ghost: 'bg-transparent px-3 text-(--accent-text) hover:bg-accent'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** One primary button per screen. Ghost is for inline actions beside a field. */
  icon?: IconName
  /** Swaps the icon for a spinner, a green check or a red cross. */
  activity?: ButtonActivity
}

export function Button({
  variant,
  icon,
  activity,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        buttonVariants({ variant }),
        // The running button waits, but its spinner must not look dimmed.
        activity === 'busy' && 'disabled:opacity-100',
        className
      )}
      {...rest}
    >
      {icon ? <ActivityIcon activity={activity} icon={icon} size="sm" /> : null}
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
  activity?: ButtonActivity
}

export function IconButton({
  label,
  icon,
  activity,
  size = 'md',
  active = false,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-grid flex-none cursor-pointer place-items-center border-0 p-0 transition-[background-color,color,transform] duration-(--motion-fast) ease-(--ease-out) active:scale-[0.97] disabled:cursor-default disabled:opacity-45 disabled:active:scale-100',
        size === 'rail' ? 'size-9 rounded-lg' : 'size-8 rounded-md',
        active
          ? 'bg-card text-(--accent)'
          : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
        activity === 'busy' && 'disabled:opacity-100',
        className
      )}
      aria-label={label}
      title={label}
      {...rest}
    >
      <ActivityIcon activity={activity} icon={icon} size="md" />
    </button>
  )
}
