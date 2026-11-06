import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'

// shadcn's button, with our variant names: `default` is the outlined button, `primary` the filled
// one (shadcn calls it `default`), `ghost` the inline action beside a field.
const buttonVariants = cva(
  'inline-flex h-9 cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-md border px-4 text-[13px] leading-[18px] transition-[background-color,color,border-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:cursor-default disabled:opacity-45 disabled:active:scale-100',
  {
    variants: {
      variant: {
        default:
          'border-border bg-transparent text-foreground hover:bg-accent disabled:hover:bg-transparent',
        primary:
          'border-primary bg-primary font-medium text-primary-foreground hover:brightness-110 disabled:hover:brightness-100',
        ghost: 'border-transparent bg-transparent px-3 text-[var(--accent-text)] hover:bg-accent'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** One primary button per screen. Ghost is for inline actions beside a field. */
  icon?: IconName
}

export function Button({
  variant,
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant }), className)} {...rest}>
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
  return (
    <button
      type={type}
      className={cn(
        'inline-grid flex-none cursor-pointer place-items-center border-0 p-0 transition-[background-color,color,border-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:cursor-default disabled:opacity-45 disabled:active:scale-100',
        size === 'rail' ? 'size-9 rounded-lg' : 'size-8 rounded-md',
        active
          ? 'bg-card text-[var(--accent)]'
          : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
        className
      )}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}
