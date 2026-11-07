import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Drawn for GitDeck: 24px viewBox, 1.8px stroke, round caps and joins, currentColor.
const SHAPES = {
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  repo: (
    <>
      <path d="M6 3h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2V4a1 1 0 0 1 1-1z" />
      <path d="M5 19a2 2 0 0 0 2 2h12v-4" />
    </>
  ),
  'git-branch': (
    <>
      <circle cx="6" cy="5" r="2.2" />
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <path d="M6 7.2v9.6" />
      <path d="M18 10.2c0 4-4 5-12 7" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.8a3 3 0 0 1 0 6" />
      <path d="M18 14.5c2 .7 3 2.6 3 5.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 4h8l9.5 9.5a1.5 1.5 0 0 1 0 2.1l-5 5a1.5 1.5 0 0 1-2.1 0L3 12z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17.2v.01" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  columns: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14" />
    </>
  ),
  rotate: (
    <>
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h14" />
      <path d="M14 4l4 4-4 4" />
      <path d="M20 16H6" />
      <path d="M10 12l-4 4 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  'arrow-up': (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  more: <path d="M5 12v.01M12 12v.01M19 12v.01" />,
  rocket: (
    <>
      <path d="M12 3c3.5 2 5.5 5.5 5.5 9l-2.5 3H9l-2.5-3C6.5 8.5 8.5 5 12 3z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M8.5 14L5 15.5 6 19l3-1.5" />
      <path d="M15.5 14l3.5 1.5L18 19l-3-1.5" />
      <path d="M10.5 18.5L12 21l1.5-2.5" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5v.01M7 16.5v.01" />
    </>
  ),
  box: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3 5h18v4H3z" />
      <path d="M10 13h4" />
    </>
  ),
  package: (
    <>
      <path d="M12 3l8 4v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </>
  ),
  code: <path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />,
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 10l3 2-3 2M12 15h5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  cloud: <path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </>
  ),
  zap: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  bookmark: <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z" />,
  book: (
    <>
      <path d="M12 6c-2-1.5-5-2-8-2v13c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z" />
      <path d="M12 6v13" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 13h18" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </>
  ),
  tool: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9A6 6 0 0 1 17.9 2.5z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M10.5 3.5h3l.5 2.2 1.7 1 2.1-.8 1.5 2.6-1.6 1.6v2l1.6 1.6-1.5 2.6-2.1-.8-1.7 1-.5 2.2h-3l-.5-2.2-1.7-1-2.1.8-1.5-2.6 1.6-1.6v-2L4.7 8.5l1.5-2.6 2.1.8 1.7-1z" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.5-1.2-.3-.4-.5-.7-.5-1.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8.2-9-8.2z" />
      <circle cx="7.5" cy="11" r=".9" />
      <circle cx="10" cy="7.5" r=".9" />
      <circle cx="14.5" cy="7.5" r=".9" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10 4l1.8 4.7L16.5 10.5l-4.7 1.8L10 17l-1.8-4.7L3.5 10.5l4.7-1.8z" />
      <path d="M18 3v4M16 5h4M18 17v4M16 19h4" />
    </>
  ),
  plug: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  'bar-chart': <path d="M5 20v-9M12 20V4M19 20v-6" />,
  smartphone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  )
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof SHAPES

export const isIconName = (value: string): value is IconName => value in SHAPES

interface IconProps {
  name: IconName
  /** `md` is the 18px toolbar size, `sm` the 14px size inside buttons and rows. */
  size?: 'md' | 'sm' | 'xs'
  /** Set only when the icon stands alone and carries meaning. */
  label?: string
}

export function Icon({ name, size = 'md', label }: IconProps) {
  return (
    <svg
      className={cn(
        'flex-none fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]',
        size === 'md'
          ? 'size-[var(--icon-size)]'
          : size === 'sm'
            ? 'size-[var(--icon-size-sm)]'
            : 'size-3'
      )}
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {SHAPES[name]}
    </svg>
  )
}
