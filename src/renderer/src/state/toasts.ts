import { createContext, useContext } from 'react'
import type { Toast } from '../lib/toasts'

/** Shows an error toast. The app's `ToastProvider` supplies it. */
export type PushToast = (toast: Omit<Toast, 'id'>) => void

export const ToastContext = createContext<PushToast>(() => {})

export function usePushToast(): PushToast {
  return useContext(ToastContext)
}
