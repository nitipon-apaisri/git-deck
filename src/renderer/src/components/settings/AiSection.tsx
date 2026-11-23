import { useEffect, useState } from 'react'
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  aiDestination,
  isAiProvider,
  normalizeAiBaseUrl
} from '@shared/ai'
import { cn } from '@/lib/cn'
import { errorMessage } from '../../lib/errors'
import {
  aiConfigOf,
  setAiEnabled,
  setAiSettings,
  useAiEnabled,
  useAiSettings
} from '../../state/ai'
import { Button, CheckOption, Field, Icon, Select, TextInput } from '../ui'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'ok'; text: string }
  | { kind: 'error'; text: string }

const PROVIDER_OPTIONS = AI_PROVIDER_IDS.map((id) => ({ value: id, label: AI_PROVIDERS[id].label }))

function urlError(input: string): string | null {
  if (!input.trim()) return null
  try {
    normalizeAiBaseUrl(input)
    return null
  } catch (err) {
    return errorMessage(err)
  }
}

/** Opt-in commit message suggestions: pick a provider, store its key, test it. */
export function AiSection() {
  const enabled = useAiEnabled()
  const settings = useAiSettings()
  const { provider } = settings
  const info = AI_PROVIDERS[provider]
  const config = aiConfigOf(settings)
  const [key, setKey] = useState('')
  // Tagged with its provider, so a switch shows "unknown" until main answers.
  const [saved, setSaved] = useState<{ provider: string; has: boolean } | null>(null)
  const hasKey = saved?.provider === provider ? saved.has : null
  const setHasKey = (has: boolean): void => setSaved({ provider, has })
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    let live = true
    if (info.key) {
      const done = (has: boolean): void => {
        if (live) setSaved({ provider, has })
      }
      window.api.ai.hasKey(provider).then(done, () => done(false))
    }
    return () => {
      live = false
    }
  }, [provider, info.key])

  const destination = aiDestination(config)
  const warning =
    info.kind === 'cli'
      ? `The staged diff (first 60 KB) is sent through ${destination}, to the service it is signed in to. GitDeck stores no key: the CLI uses your own sign-in.`
      : `The staged diff (first 60 KB) is sent to ${destination}. The API key is stored encrypted in your OS keychain and never leaves this computer except in that request.`

  function choose(next: string): void {
    if (!isAiProvider(next)) return
    setAiSettings({ provider: next })
    setKey('')
    setStatus({ kind: 'idle' })
  }

  async function run(text: string, work: () => Promise<string>): Promise<void> {
    setStatus({ kind: 'busy', text })
    try {
      setStatus({ kind: 'ok', text: await work() })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    }
  }

  const saveKey = (): Promise<void> =>
    run('Saving key', async () => {
      await window.api.ai.saveKey(provider, key)
      setKey('')
      setHasKey(true)
      return 'Key saved.'
    })

  const removeKey = (): Promise<void> =>
    run('Removing key', async () => {
      await window.api.ai.removeKey(provider)
      setHasKey(false)
      return 'Key removed.'
    })

  const test = (): Promise<void> =>
    run(
      `Asking ${info.label}`,
      async () => `Works. Sample reply: ${await window.api.ai.test(config)}`
    )

  const busy = status.kind === 'busy'
  const badUrl = provider === 'compatible' ? urlError(settings.baseUrl) : null
  const canTest =
    !busy &&
    !badUrl &&
    (provider !== 'compatible' || settings.baseUrl.trim() !== '') &&
    (info.key !== true || hasKey === true)

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] leading-5 text-muted-foreground">
        Adds a sparkles button inside the commit message field. It suggests a message for the staged
        changes and fills the field. You edit it and commit as usual: nothing is committed for you.
      </p>
      <CheckOption
        label="Suggest commit messages with AI"
        checked={enabled}
        onChange={setAiEnabled}
        warning={warning}
      />

      <Field label="Provider">
        {(c) => <Select {...c} options={PROVIDER_OPTIONS} value={provider} onChange={choose} />}
      </Field>

      {provider === 'compatible' ? (
        <Field
          label="Server URL"
          hint={
            <>
              The API root, for example <code>https://api.example.com/v1</code> or{' '}
              <code>http://localhost:11434/v1</code>. GitDeck calls <code>/chat/completions</code>.
            </>
          }
          error={badUrl}
        >
          {(c) => (
            <TextInput
              {...c}
              value={settings.baseUrl}
              placeholder="https://api.example.com/v1"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setAiSettings({ baseUrl: e.target.value })}
            />
          )}
        </Field>
      ) : null}

      {provider !== 'claude' ? (
        <Field
          label="Model"
          hint={
            info.defaultModel
              ? `Empty uses ${info.defaultModel}.`
              : info.kind === 'cli'
                ? 'Empty uses the CLI’s own default.'
                : 'Required: the model name the server expects.'
          }
        >
          {(c) => (
            <TextInput
              {...c}
              value={settings.models[provider] ?? ''}
              placeholder={info.defaultModel ?? ''}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) =>
                setAiSettings({ models: { ...settings.models, [provider]: e.target.value } })
              }
            />
          )}
        </Field>
      ) : null}

      {info.key ? (
        <Field
          label={info.key === 'optional' ? 'API key (optional)' : 'API key'}
          hint={
            hasKey
              ? 'A key is saved. Enter a new one to replace it.'
              : 'Stored encrypted in your OS keychain. GitDeck never shows it again.'
          }
        >
          {(c) => (
            <div className="flex gap-2">
              <TextInput
                {...c}
                className="flex-1"
                type="password"
                value={key}
                placeholder={hasKey ? '••••••••' : ''}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button onClick={() => void saveKey()} disabled={busy || key.trim() === ''}>
                Save key
              </Button>
              {hasKey ? (
                <Button onClick={() => void removeKey()} disabled={busy}>
                  Remove
                </Button>
              ) : null}
            </div>
          )}
        </Field>
      ) : null}

      {status.kind !== 'idle' ? (
        <p
          className={cn(
            'm-0 flex items-start gap-2.5 rounded-lg px-4 py-2.5 break-words whitespace-pre-wrap',
            status.kind === 'ok' && 'bg-(--success-bg) text-(--success-text)',
            status.kind === 'error' && 'bg-(--warning-bg) text-destructive',
            status.kind === 'busy' && 'bg-secondary text-muted-foreground'
          )}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="mt-0.5">
            <Icon
              name={status.kind === 'ok' ? 'check' : status.kind === 'error' ? 'alert' : 'refresh'}
            />
          </span>
          <span className="min-w-0">
            {status.kind === 'busy' ? `${status.text}…` : status.text}
          </span>
        </p>
      ) : null}

      <div className="flex items-center gap-2.5">
        <Button onClick={() => void test()} disabled={!canTest}>
          Test
        </Button>
        <span className="text-[12px] leading-4 text-muted-foreground">
          {info.kind === 'cli' ? (
            <>
              Needs the <code>{info.target}</code> command installed and signed in.
            </>
          ) : (
            'Sends a tiny sample diff, no repository data.'
          )}
        </span>
      </div>
      <p className="m-0 text-[12px] leading-4 text-muted-foreground">
        It only runs when you press the sparkles button or Test.
      </p>
    </div>
  )
}
