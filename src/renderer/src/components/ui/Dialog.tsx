import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './Dialog.module.css'

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

/**
 * Uses the native modal `<dialog>`, which traps focus and closes on Escape. Focus goes
 * back to the opener when it unmounts. Mount it to open it, unmount it to close it.
 */
export function Dialog({
  title,
  description,
  width = 520,
  onClose,
  children,
  actionsStart,
  actions
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  // The latest handler, without re-running the open effect when it changes.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // A layout effect, so cleanup runs while the dialog is still in the page. React removes
  // the element before passive cleanups, and a detached dialog cannot give focus back.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onCancel = (event: Event): void => {
      // The caller owns the open state, so hand Escape to it instead of closing here.
      event.preventDefault()
      closeRef.current()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      if (dialog.open) dialog.close()
      // Put focus back on whatever opened the dialog, if it is still there.
      if (opener?.isConnected) opener.focus()
    }
  }, [])

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
