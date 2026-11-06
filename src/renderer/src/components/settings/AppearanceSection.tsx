import { useRef, type KeyboardEvent } from 'react'
import { ACCENTS, type Accent } from '../../lib/accent'
import { FONTS, type FontId } from '../../lib/font'
import type { ThemeSetting } from '../../lib/theme'
import { useAccent, useFont } from '../../state/appearance'
import { Icon } from '../ui'
import { ThemePreview } from './ThemePreview'
import styles from './Option.module.css'
import section from './Section.module.css'

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
    <div className={section.stack}>
      <section className={section.block} aria-labelledby="set-theme">
        <h3 id="set-theme" className={section.label}>
          Theme
        </h3>
        <p className={section.hint}>System follows your OS appearance.</p>
        <div
          role="radiogroup"
          aria-labelledby="set-theme"
          className={`${styles.group} ${styles.cards}`}
        >
          {THEME_ORDER.map((value, index) => (
            <button
              key={value}
              ref={themeKeys.ref(index)}
              type="button"
              role="radio"
              aria-checked={value === theme}
              tabIndex={themeKeys.tab(value)}
              className={`${styles.card} ${value === theme ? styles.checked : ''}`}
              onClick={() => onThemeChange(value)}
              onKeyDown={(e) => themeKeys.onKeyDown(e, index)}
            >
              <ThemePreview setting={value} />
              <span>
                <span className={styles.cardLabel}>{THEME_LABELS[value].title}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={section.block} aria-labelledby="set-accent">
        <h3 id="set-accent" className={section.label}>
          Accent colour
        </h3>
        <p className={section.hint}>Used for the primary button, selection and focus ring.</p>
        <div role="radiogroup" aria-labelledby="set-accent" className={styles.swatches}>
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
              className={styles.swatch}
              onClick={() => setAccent(a.id)}
              onKeyDown={(e) => accentKeys.onKeyDown(e, index)}
            >
              <AccentDot id={a.id} checked={a.id === accent} />
            </button>
          ))}
          <span className={styles.swatchName} aria-hidden="true">
            {ACCENTS.find((a) => a.id === accent)?.label}
          </span>
        </div>
      </section>

      <section className={section.block} aria-labelledby="set-font">
        <h3 id="set-font" className={section.label}>
          Font family
        </h3>
        <p className={section.hint}>Applies to the whole app. Code and hashes stay monospaced.</p>
        <div
          role="radiogroup"
          aria-labelledby="set-font"
          className={`${styles.group} ${styles.fonts}`}
        >
          {FONTS.map((f, index) => (
            <button
              key={f.id}
              ref={fontKeys.ref(index)}
              type="button"
              role="radio"
              aria-checked={f.id === font}
              tabIndex={fontKeys.tab(f.id)}
              className={`${styles.card} ${f.id === font ? styles.checked : ''}`}
              onClick={() => setFont(f.id)}
              onKeyDown={(e) => fontKeys.onKeyDown(e, index)}
            >
              <span className={styles.cardLabel} style={{ fontFamily: f.family }}>
                {f.label}
              </span>
              <span className={styles.fontSample} style={{ fontFamily: f.family }}>
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
    <span className={styles.dot} data-accent-dot={id} aria-hidden="true">
      {checked ? <Icon name="check" size="sm" /> : null}
    </span>
  )
}
