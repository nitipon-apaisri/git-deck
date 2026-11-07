import type { ThemeSetting } from '../../lib/theme'

const LINE = 'h-1 rounded-[2px] bg-(--line)'

/**
 * A tiny mock of the app shell. It carries its own `data-theme`, so it draws with that theme's
 * tokens. It uses the raw tokens: they re-resolve inside a `data-theme` element.
 */
function Mock({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <span
      className="flex h-16 w-full gap-1 rounded-sm bg-(--window) p-[5px]"
      data-theme={theme}
      aria-hidden="true"
    >
      <span className="w-1.5 rounded-[2px] bg-(--island-raised)" />
      <span className="flex w-[30%] flex-col gap-1 rounded-(--radius-xs) bg-(--island) p-1">
        <span className={LINE} />
        <span className={LINE} />
        <span className="h-1 rounded-[2px] bg-(--accent)" />
      </span>
      <span className="flex flex-1 flex-col gap-1 rounded-(--radius-xs) bg-(--island) p-1">
        <span className="h-2 w-1/2 rounded-[2px] bg-(--text-muted)" />
        <span className={LINE} />
      </span>
    </span>
  )
}

export function ThemePreview({ setting }: { setting: ThemeSetting }) {
  if (setting === 'system') {
    return (
      <span className="relative block h-16 w-full" aria-hidden="true">
        <span className="absolute inset-0 overflow-hidden [clip-path:inset(0_50%_0_0)]">
          <Mock theme="light" />
        </span>
        <span className="absolute inset-0 overflow-hidden [clip-path:inset(0_0_0_50%)]">
          <Mock theme="dark" />
        </span>
      </span>
    )
  }
  return <Mock theme={setting} />
}
