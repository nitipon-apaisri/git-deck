import { PROJECT_ICONS } from '../../../../shared/projects'
import { Icon, isIconName, type IconName } from './Icon'
import { cn } from '@/lib/cn'

// Compile-time check: every built-in project icon id has a drawn glyph.
const _drawn: readonly IconName[] = PROJECT_ICONS
void _drawn

interface ProjectIconProps {
  /** A glyph id or a single emoji, as stored on the project. */
  icon: string
  /** One of the eight palette ids: blue, teal, violet, amber, rose, green, pink, gray. */
  color: string
  size?: 'lg' | 'md' | 'sm'
}

// `--tile` is the project's palette colour: the glyph, and a 20% wash behind it.
const COLORS: Record<string, string> = {
  blue: '[--tile:var(--proj-blue)]',
  teal: '[--tile:var(--proj-teal)]',
  violet: '[--tile:var(--proj-violet)]',
  amber: '[--tile:var(--proj-amber)]',
  rose: '[--tile:var(--proj-rose)]',
  green: '[--tile:var(--proj-green)]',
  pink: '[--tile:var(--proj-pink)]',
  gray: '[--tile:var(--proj-gray)]'
}

/** The tile that names a project. Pair it with the name: colour alone never does. */
export function ProjectIcon({ icon, color, size = 'md' }: ProjectIconProps) {
  const isEmoji = /\p{Extended_Pictographic}/u.test(icon)
  return (
    <span
      className={cn(
        'inline-grid flex-none place-items-center bg-[color-mix(in_srgb,var(--tile)_20%,transparent)] text-[var(--tile)]',
        COLORS[color] ?? COLORS.gray,
        size === 'lg' && 'size-12 rounded-[var(--radius-dialog)] text-[24px] [&_svg]:size-[26px]',
        size === 'md' && 'size-9 rounded-lg',
        size === 'sm' && 'size-7 rounded-md'
      )}
      aria-hidden="true"
    >
      {isEmoji ? icon : <Icon name={isIconName(icon) ? icon : 'folder'} />}
    </span>
  )
}
