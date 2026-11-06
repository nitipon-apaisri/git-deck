import { useId, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './Dialog.module.css'
import { useModalDialog } from './useModalDialog'

interface DialogProps {
  title: string
  description?: string
  /** 520 for most dialogs, 560 for the project dialog. */
  width?: 520 | 560
  onClose: () => void
  children: ReactNode
  /** Test and secondary actions, left in the footer. */
  actionsStart?: ReactNode
  /** Cancel and the one primary action, right-aligned. */
  actions?: ReactNode
}

/** A modal dialog, see `useModalDialog`. Mount it to open it, unmount it to close it. */
export function Dialog({
  title,
  description,
  width = 520,
  onClose,
  children,
  actionsStart,
  actions
}: DialogProps) {
  const ref = useModalDialog(onClose)
  const titleId = useId()
  const descriptionId = useId()

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${width === 560 ? styles.wide : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          ) : null}
        </div>
        <IconButton label="Close" icon="x" onClick={onClose} />
      </header>
      <div className={styles.body}>{children}</div>
      {actionsStart || actions ? (
        <footer className={styles.footer}>
          {actionsStart}
          <span className={styles.spacer} />
          {actions}
        </footer>
      ) : null}
    </dialog>
  )
}
