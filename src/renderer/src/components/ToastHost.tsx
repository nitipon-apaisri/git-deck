import { useCallback, useReducer, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { toastsReducer, type Toast } from '../lib/toasts'
import { ToastContext, type PushToast } from '../state/toasts'
import { CopyButton, Icon, IconButton } from './ui'

/** Holds the toasts for the whole window, so a failure in either Split View pane shows. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastsReducer, [])
  const nextId = useRef(0)
  const push = useCallback<PushToast>((toast) => {
    nextId.current += 1
    dispatch({ type: 'add', toast: { ...toast, id: nextId.current } })
  }, [])
  const dismiss = useCallback((id: number) => dispatch({ type: 'dismiss', id }), [])
  return (
    <ToastContext value={push}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  )
}

function ToastHost({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onDismiss()
  }
  return (
    <div
      role="alert"
      onKeyDown={onKeyDown}
      className="relative flex animate-banner-in items-start gap-2 rounded-lg border-l-[3px] border-(--danger) bg-card px-3 py-2.5 text-foreground shadow-(--shadow-menu) motion-reduce:animate-none"
    >
      <span className="mt-0.5 flex-none text-(--danger)">
        <Icon name="x" size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">
          {toast.repo}: {toast.action}
        </p>
        <p className="m-0 max-h-32 overflow-y-auto text-muted-foreground [overflow-wrap:anywhere]">
          {toast.message}
        </p>
      </div>
      <CopyButton text={`${toast.repo}: ${toast.action}\n${toast.message}`} what="details" />
      <IconButton label="Dismiss" icon="x" onClick={onDismiss} />
    </div>
  )
}
