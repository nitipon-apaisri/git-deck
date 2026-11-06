import { useRef, type KeyboardEvent } from 'react'
import { ACCENTS, type Accent } from '../../lib/accent'
import { FONTS, type FontId } from '../../lib/font'
import type { ThemeSetting } from '../../lib/theme'
import { useAccent, useFont } from '../../state/appearance'
import { Icon } from '../ui'
import { ThemePreview } from './ThemePreview'
import { cn } from '@/lib/cn'

// Shared by the pickers: a section, its title and hint, and a selectable card.
const STACK = 'flex flex-col gap-6'
const BLOCK = 'flex flex-col gap-1.5'
const LABEL = 'm-0 text-[13px] leading-[18px] font-semibold'
const HINT = 'mt-0 mb-2 text-[12px] leading-4 text-muted-foreground'
const GROUP = 'grid gap-2'
const CARD =
  'flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-transparent p-2 text-left text-foreground transition-[background-color,border-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-accent aria-checked:border-[var(--accent)] aria-checked:bg-[var(--selection)] aria-checked:hover:bg-[var(--selection)]'

const THEME_LABELS: Record<ThemeSetting, { title: string; sub: string }> = {
  system: { title: 'System', sub: 'Follows your OS' },
  light: { title: 'Light', sub: 'Always light' },
  dark: { title: 'Dark', sub: 'Always dark' }
}
const THEME_ORDER: readonly ThemeSetting[] = ['system', 'light', 'dark']

/** Arrow keys move the choice and the focus, like a native radio group. */
function useRadioKeys<T extends string>(values: readonly T[], value: T, onChange: (v: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return {
    ref: (index: number) => (node: HTMLButtonElement | null) => {
      refs.current[index] = node
    },
    onKeyDown(event: KeyboardEvent, index: number): void {
      const step = /^Arrow(Right|Down)$/.test(event.key)
        ? 1
        : /^Arrow(Left|Up)$/.test(event.key)
          ? -1
          : 0
      if (step === 0) return
      event.preventDefault()
      const next = (index + step + values.length) % values.length
      onChange(values[next])
      refs.current[next]?.focus()
    },
    tab: (v: T) => (v === value ? 0 : -1)
  }
}

interface AppearanceSectionProps {
  theme: ThemeSetting
  onThemeChange: (next: ThemeSetting) => void
}

export function AppearanceSection({ theme, onThemeChange }: AppearanceSectionProps) {
  const { accent, setAccent } = useAccent()
  const { font, setFont } = useFont()
  const themeKeys = useRadioKeys<ThemeSetting>(THEME_ORDER, theme, onThemeChange)
  const accentIds = ACCENTS.map((a) => a.id)
  const accentKeys = useRadioKeys<Accent>(accentIds, accent, setAccent)
  const fontIds = FONTS.map((f) => f.id)
  const fontKeys = useRadioKeys<FontId>(fontIds, font, setFont)

  return (
    <div className={STACK}>
      <section className={BLOCK} aria-labelledby="set-theme">
        <h3 id="set-theme" className={LABEL}>
          Theme
        </h3>
        <p className={HINT}>System follows your OS appearance.</p>
        <div role="radiogroup" aria-labelledby="set-theme" className={cn(GROUP, 'grid-cols-3')}>
          {THEME_ORDER.map((value, index) => (
            <button
              key={value}
              ref={themeKeys.ref(index)}
              type="button"
              role="radio"
              aria-checked={value === theme}
              tabIndex={themeKeys.tab(value)}
              className={CARD}
              onClick={() => onThemeChange(value)}
              onKeyDown={(e) => themeKeys.onKeyDown(e, index)}
            >
              <ThemePreview setting={value} />
              <span>
                <span className="font-medium">{THEME_LABELS[value].title}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={BLOCK} aria-labelledby="set-accent">
        <h3 id="set-accent" className={LABEL}>
          Accent colour
        </h3>
        <p className={HINT}>Used for the primary button, selection and focus ring.</p>
        <div role="radiogroup" aria-labelledby="set-accent" className="flex items-center gap-3">
          {ACCENTS.map((a, index) => (
            <button
              key={a.id}
              ref={accentKeys.ref(index)}
              type="button"
              role="radio"
              aria-label={a.label}
              title={a.label}
              aria-checked={a.id === accent}
              tabIndex={accentKeys.tab(a.id)}
              className="group grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-primary-foreground transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-out)] aria-checked:shadow-[0_0_0_2px_var(--island),0_0_0_4px_var(--primary)]"
              onClick={() => setAccent(a.id)}
              onKeyDown={(e) => accentKeys.onKeyDown(e, index)}
            >
              <AccentDot id={a.id} checked={a.id === accent} />
            </button>
          ))}
          <span className="ml-1.5 text-muted-foreground" aria-hidden="true">
            {ACCENTS.find((a) => a.id === accent)?.label}
          </span>
        </div>
      </section>

      <section className={BLOCK} aria-labelledby="set-font">
        <h3 id="set-font" className={LABEL}>
          Font family
        </h3>
        <p className={HINT}>Applies to the whole app. Code and hashes stay monospaced.</p>
        <div role="radiogroup" aria-labelledby="set-font" className={cn(GROUP, 'grid-cols-2')}>
          {FONTS.map((f, index) => (
            <button
              key={f.id}
              ref={fontKeys.ref(index)}
              type="button"
              role="radio"
              aria-checked={f.id === font}
              tabIndex={fontKeys.tab(f.id)}
              className={CARD}
              onClick={() => setFont(f.id)}
              onKeyDown={(e) => fontKeys.onKeyDown(e, index)}
            >
              <span className="font-medium" style={{ fontFamily: f.family }}>
                {f.label}
              </span>
              <span className="text-[12px] text-muted-foreground" style={{ fontFamily: f.family }}>
                The quick brown fox jumps over the lazy dog
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Shows that accent in the current theme: `appearance.css` also matches `data-accent-dot`. */
function AccentDot({ id, checked }: { id: Accent; checked: boolean }) {
  return (
    <span
      className="grid size-7 place-items-center rounded-full bg-[var(--primary)] transition-transform duration-[var(--motion-fast)] ease-[var(--ease-out)] group-hover:scale-[1.08]"
      data-accent-dot={id}
      aria-hidden="true"
    >
      {checked ? <Icon name="check" size="sm" /> : null}
    </span>
  )
}
