// Pure: the stack of error toasts. No React, so it runs under tsx tests.
export interface Toast {
  id: number
  /** The repository the write ran on. */
  repo: string
  /** "push failed". */
  action: string
  /** What git or the host said. */
  message: string
}

export type ToastAction = { type: 'add'; toast: Toast } | { type: 'dismiss'; id: number }

/** At most this many show at once: a burst of failures must not cover the window. */
export const MAX_TOASTS = 3

/** Newest first. A fourth toast pushes the oldest out. */
export function toastsReducer(state: Toast[], action: ToastAction): Toast[] {
  if (action.type === 'dismiss') return state.filter((t) => t.id !== action.id)
  return [action.toast, ...state].slice(0, MAX_TOASTS)
}
