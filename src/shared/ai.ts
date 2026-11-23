// Commit message providers: the list both sides show, and the URL rule for a custom server.
import { normalizeBaseUrl } from './baseUrl'

export type AiProviderId = 'claude' | 'openai' | 'gemini' | 'compatible' | 'codex' | 'opencode'

/** Sent with every call. Non-secret: the key stays in main. */
export interface AiConfig {
  provider: AiProviderId
  /** Empty or missing means the provider's default. */
  model?: string
  /** `compatible` only. */
  baseUrl?: string
}

export interface AiProviderInfo {
  label: string
  kind: 'http' | 'cli'
  /** `true` when a key is required; `compatible` takes one but a local server may need none. */
  key: boolean | 'optional'
  /** HTTP: the fixed host. CLI: the command. */
  target: string
  defaultModel?: string
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
  claude: { label: 'Claude Code CLI', kind: 'cli', key: false, target: 'claude' },
  openai: {
    label: 'OpenAI',
    kind: 'http',
    key: true,
    target: 'api.openai.com',
    defaultModel: 'gpt-5-mini'
  },
  gemini: {
    label: 'Google Gemini',
    kind: 'http',
    key: true,
    target: 'generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash'
  },
  compatible: { label: 'OpenAI-compatible server', kind: 'http', key: 'optional', target: '' },
  codex: { label: 'Codex CLI', kind: 'cli', key: false, target: 'codex' },
  opencode: { label: 'OpenCode CLI', kind: 'cli', key: false, target: 'opencode' }
}

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[]

export function isAiProvider(value: unknown): value is AiProviderId {
  return typeof value === 'string' && Object.hasOwn(AI_PROVIDERS, value)
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** https, or plain http for this computer only (Ollama, LM Studio). Throws a plain message. */
export function normalizeAiBaseUrl(input: string): string {
  if (!input.trim()) throw new Error('Enter the server URL')
  // The account type only picks the empty-input default, which cannot happen here.
  const url = normalizeBaseUrl('github', input)
  const { protocol, hostname } = new URL(url)
  if (protocol === 'http:' && !LOCAL_HOSTS.has(hostname)) {
    throw new Error('Use https://, or http:// only for a server on this computer')
  }
  return url
}

/** Where the staged diff goes, for the warning under the option. */
export function aiDestination(config: AiConfig): string {
  const info = AI_PROVIDERS[config.provider]
  if (info.kind === 'cli') return `the ${info.label} installed on this computer`
  if (config.provider !== 'compatible') return `${info.label} (${info.target})`
  try {
    return new URL(normalizeAiBaseUrl(config.baseUrl ?? '')).host
  } catch {
    return 'the server you enter'
  }
}
