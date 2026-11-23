import type { AiProviderId } from '@shared/ai'
import claude from '../../assets/logos/claude.svg'
import gemini from '../../assets/logos/gemini.svg'
import openaiDark from '../../assets/logos/openai-dark.svg'
import openaiLight from '../../assets/logos/openai-light.svg'
import opencodeDark from '../../assets/logos/opencode-dark.svg'
import opencodeLight from '../../assets/logos/opencode-light.svg'
import { Icon } from './Icon'

const LOGO = 'size-4 flex-none'

/** Mono marks ship a light-theme and a dark-theme file; the theme picks one. Logos from svgl.app. */
function Themed({ light, dark }: { light: string; dark: string }) {
  return (
    <>
      <img className={`${LOGO} dark:hidden`} src={light} alt="" aria-hidden="true" />
      <img className={`${LOGO} hidden dark:inline`} src={dark} alt="" aria-hidden="true" />
    </>
  )
}

/** The mark of an AI provider. Codex is OpenAI's; a custom server has no brand, so it gets a glyph. */
export function ProviderLogo({ provider }: { provider: AiProviderId }) {
  switch (provider) {
    case 'claude':
      return <img className={LOGO} src={claude} alt="" aria-hidden="true" />
    case 'gemini':
      return <img className={LOGO} src={gemini} alt="" aria-hidden="true" />
    case 'openai':
    case 'codex':
      return <Themed light={openaiLight} dark={openaiDark} />
    case 'opencode':
      return <Themed light={opencodeLight} dark={opencodeDark} />
    case 'compatible':
      return (
        <span className={`${LOGO} grid place-items-center text-muted-foreground`}>
          <Icon name="server" size="sm" />
        </span>
      )
  }
}
