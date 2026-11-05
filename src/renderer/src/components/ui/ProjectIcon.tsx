import { PROJECT_ICONS } from '../../../../shared/projects'
import { Icon, isIconName, type IconName } from './Icon'
import styles from './ProjectIcon.module.css'

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

/** The tile that names a project. Pair it with the name: colour alone never does. */
export function ProjectIcon({ icon, color, size = 'md' }: ProjectIconProps) {
  const isEmoji = /\p{Extended_Pictographic}/u.test(icon)
  return (
    <span className={`${styles.tile} ${styles[size]}`} data-color={color} aria-hidden="true">
      {isEmoji ? icon : <Icon name={isIconName(icon) ? icon : 'folder'} />}
    </span>
  )
}
