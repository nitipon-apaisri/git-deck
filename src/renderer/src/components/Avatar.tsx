import { useState } from 'react'

// Soft tints with dark text keep initials readable and the UI calm.
const HUES = [18, 30, 42, 150, 190, 215, 270, 335]

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
    <span className="avatar avatar-fallback" style={{ ...style, background: `hsl(${HUES[hash(name) % HUES.length]} 70% 90%)`, color: `hsl(${HUES[hash(name) % HUES.length]} 50% 26%)` }}>
      {initials(name)}
    </span>
  )
}
