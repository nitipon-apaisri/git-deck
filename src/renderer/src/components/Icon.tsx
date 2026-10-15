const PATHS = {
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.5-4.5',
  plus: 'M12 5v14 M5 12h14',
  x: 'M6 6l12 12 M18 6L6 18',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  refresh: 'M21 12a9 9 0 1 1-3-6.7 M21 4v5h-5',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14',
  external: 'M14 4h6v6 M20 4L10 14 M18 14v6H4V6h6',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  fork: 'M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3 M12 12v9',
  check: 'M5 12l5 5 9-10',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
