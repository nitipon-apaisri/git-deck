import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

// The production CSP forbids inline scripts, but Vite's dev server injects one
// for React refresh. Strip the CSP meta tag in dev only.
function stripCspInDev(): Plugin {
  return {
    name: 'gitdeck:strip-csp-in-dev',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html
        return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, '')
      }
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss(), stripCspInDev()]
  }
})
