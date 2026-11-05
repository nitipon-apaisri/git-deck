import { useState } from 'react'
import { avatarIndex, initialsOf } from '../../lib/format'
import styles from './Avatar.module.css'

interface AvatarProps {
  /** Image URL. When it is missing or fails to load, coloured initials show instead. */
  src?: string
  name: string
  size?: 24 | 28 | 32
}

export function Avatar({ src, name, size = 28 }: AvatarProps) {
  // Remember which URL failed, so a new `src` gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src
  return (
    <span className={`${styles.avatar} ${styles[`s${size}`]}`} data-tone={avatarIndex(name)}>
      {showImage ? (
        <img src={src} alt="" className={styles.image} onError={() => setFailedSrc(src ?? null)} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  )
}
