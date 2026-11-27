// README markdown to safe HTML. No DOM: runs under tsx.
// Allowlist by construction: raw HTML from the source is dropped, so only tags that marked
// itself writes can appear, and every link or image URL is checked here.
import { Marked, type Tokens } from 'marked'

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** The URL when it is absolute `https:`, else `null`. */
export function safeHttps(href: string): string | null {
  try {
    const url = new URL(href)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const marked = new Marked({
  gfm: true,
  async: false,
  renderer: {
    // Raw HTML in a README (badges, centred logos, <script>) is dropped, never parsed.
    html: () => '',
    // One level down: the Overview page owns the only <h1>, and the README sits under an <h2>.
    heading(
      this: { parser: { parseInline(t: Tokens.Heading['tokens']): string } },
      token: Tokens.Heading
    ) {
      const level = Math.min(token.depth + 1, 6)
      return `<h${level}>${this.parser.parseInline(token.tokens)}</h${level}>\n`
    },
    link(this: { parser: { parseInline(t: Tokens.Link['tokens']): string } }, token: Tokens.Link) {
      const text = this.parser.parseInline(token.tokens)
      const href = safeHttps(token.href)
      // Relative and non-https links keep their text only.
      if (!href) return text
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
      return `<a href="${escapeHtml(href)}"${title}>${text}</a>`
    },
    image(token: Tokens.Image) {
      const src = safeHttps(token.href)
      const alt = escapeHtml(token.text || 'image')
      // Relative images would need the repository's files: shown as a placeholder.
      if (!src) return `<span class="md-image-placeholder">Image: ${alt}</span>`
      return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`
    }
  }
})

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string
}
