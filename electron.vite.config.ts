import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Vite's dev server injects inline scripts (React refresh), which the strict CSP
// would block. Strip the CSP meta tag in dev only; production builds keep it.
function stripCspInDev(): Plugin {
  return {
    name: 'gitdeck:strip-csp-in-dev',
    transformIndexHtml(html, ctx) {
      if (!ctx.server) return html
      return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, '')
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    plugins: [react(), stripCspInDev()]
  }
})
