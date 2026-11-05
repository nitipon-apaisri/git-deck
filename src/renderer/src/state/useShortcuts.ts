import { useEffect } from 'react'
import { shortcutOf, type ShortcutAction } from '../lib/splitLayout'

/** Window-level shortcuts for Split View. Pass a stable handler (`useCallback`). */
export function useShortcuts(onAction: (action: ShortcutAction) => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat) return
      const action = shortcutOf(event)
      if (action === null) return
      event.preventDefault()
      onAction(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAction])
}
