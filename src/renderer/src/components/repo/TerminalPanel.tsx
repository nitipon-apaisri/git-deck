import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { cn } from '@/lib/cn'
import { errorMessage } from '../../lib/errors'
import { terminalColors } from '../../lib/terminalTheme'
import { Button, IconButton } from '../ui'

interface TerminalPanelProps {
  /** A linked folder: the shell starts here. */
  path: string
  /** Hidden panels keep their shell running. */
  visible: boolean
  onClose: () => void
}

function readToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token)
}

/**
 * One shell for one pane. The pane owns it, so two panes in Split View each have their
 * own session. It ends when the panel unmounts.
 */
export function TerminalPanel({ path, visible, onClose }: TerminalPanelProps) {
  const host = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fit = useRef<FitAddon | null>(null)
  const session = useRef<string | null>(null)
  const visibleRef = useRef(visible)
  const [run, setRun] = useState(0)
  const [ended, setEnded] = useState<number | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    visibleRef.current = visible
    if (visible) {
      fitNow()
      term.current?.focus()
    }
  }, [visible])

  function fitNow(): void {
    const t = term.current
    if (!t || !fit.current || !host.current || host.current.clientHeight === 0) return
    fit.current.fit()
    const id = session.current
    if (id) void window.api.terminal.resize(id, t.cols, t.rows).catch(() => {})
  }

  useEffect(() => {
    const el = host.current
    if (!el) return
    setEnded(null)
    setProblem(null)
    const t = new Terminal({
      cursorBlink: true,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono'),
      fontSize: 13,
      scrollback: 5000,
      allowProposedApi: false,
      theme: terminalColors(readToken)
    })
    const fitAddon = new FitAddon()
    t.loadAddon(fitAddon)
    t.open(el)
    term.current = t
    fit.current = fitAddon
    // Let the window shortcuts (Ctrl+` to toggle) see the key instead of the shell.
    t.attachCustomKeyEventHandler((e) => !(e.ctrlKey && e.code === 'Backquote'))
    if (el.clientHeight > 0) fitAddon.fit()

    let id: string | null = null
    let disposed = false
    // Output can arrive before `create` has returned the id.
    const early: { id: string; data: string }[] = []
    const offData = window.api.terminal.onData((from, data) => {
      if (id === null) early.push({ id: from, data })
      else if (from === id) t.write(data)
    })
    const offExit = window.api.terminal.onExit((from, code) => {
      if (from === (id ?? '')) {
        session.current = null
        setEnded(code)
      }
    })
    const input = t.onData((data) => {
      if (id) void window.api.terminal.write(id, data).catch(() => {})
    })

    window.api.terminal
      .create(path, Math.max(t.cols, 2), Math.max(t.rows, 2))
      .then((created) => {
        if (disposed) {
          void window.api.terminal.kill(created).catch(() => {})
          return
        }
        id = created
        session.current = created
        for (const chunk of early) if (chunk.id === created) t.write(chunk.data)
        early.length = 0
        fitNow()
        if (visibleRef.current) t.focus()
      })
      .catch((err: unknown) => {
        if (!disposed) setProblem(errorMessage(err))
      })

    const observer = new ResizeObserver(() => fitNow())
    observer.observe(el)
    const theme = new MutationObserver(() => {
      t.options.theme = terminalColors(readToken)
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      disposed = true
      observer.disconnect()
      theme.disconnect()
      offData()
      offExit()
      input.dispose()
      if (id) void window.api.terminal.kill(id).catch(() => {})
      session.current = null
      t.dispose()
      term.current = null
      fit.current = null
    }
  }, [path, run])

  return (
    <div
      className={cn(
        'flex h-72 min-h-0 flex-none flex-col border-t border-border bg-card',
        !visible && 'hidden'
      )}
      aria-label="Terminal"
      role="region"
    >
      <div className="flex h-8 flex-none items-center gap-2 px-4 text-[12px] text-muted-foreground">
        <span className="font-medium">Terminal</span>
        <span className="min-w-0 flex-1 truncate" title={path}>
          {path}
        </span>
        <IconButton label="Close terminal" icon="x" className="size-6" onClick={onClose} />
      </div>
      <div className="relative min-h-0 flex-1 px-4 pb-2">
        <div ref={host} className="size-full" />
        {ended !== null || problem ? (
          <div className="absolute inset-x-4 bottom-2 flex items-center gap-3 rounded-md bg-(--warning-bg) px-3 py-2 text-[12px] text-warning">
            <span className="min-w-0 flex-1 wrap-anywhere" role="status">
              {problem ?? `The shell exited with code ${ended}.`}
            </span>
            <Button onClick={() => setRun((n) => n + 1)}>Restart</Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
