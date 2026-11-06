import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Opens a native modal `<dialog>` on mount, which traps focus, and hands Escape to
 * `onClose`. Focus goes back to the opener when it unmounts. Mount it to open it,
 * unmount it to close it.
 */
export function useModalDialog(onClose: () => void): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null)
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

  return ref
}
