import { useState } from 'react'

const COLORS = ['#e5534b', '#c69026', '#57ab5a', '#39c5cf', '#539bf5', '#986ee2', '#e275ad', '#f69d50']

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase()
}

/** Image avatar that falls back to coloured initials when missing or broken. */
export function Avatar({ name, url, size = 20 }: { name: string; url?: string; size?: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }
  if (url && !failed) {
    return <img className="avatar" style={style} src={url} alt="" onError={() => setFailed(true)} />
  }
  return (
    <span className="avatar avatar-fallback" style={{ ...style, background: COLORS[hash(name) % COLORS.length] }}>
      {initials(name)}
    </span>
  )
}
