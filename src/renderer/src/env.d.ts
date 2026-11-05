/// <reference types="vite/client" />
import type { Api } from '@shared/api'

declare global {
  interface Window {
    /** Exposed by the preload script. */
    api: Api
  }
}
