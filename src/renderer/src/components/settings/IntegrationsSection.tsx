import { useState, type ReactNode } from 'react'
import type { Account, AccountInput } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import {
  PRESETS,
  TOKEN_SCOPES,
  hostTileOf,
  hostnameOf,
  presetOf,
  tokenUrl,
  tryNormalize,
  type PresetId
} from '../../lib/presets'
import {
  Button,
  CheckOption,
  ChoiceGroup,
  Field,
  HostTile,
  Icon,
  IconButton,
  TextInput,
  type Choice
} from '../ui'
import styles from './IntegrationsSection.module.css'

interface IntegrationsSectionProps {
  accounts: Account[]
  /** `false` blocks saving a token; `null` while main has not answered yet. */
  secureStorage: boolean | null
  onAdded: (account: Account) => void
  onRemove: (accountId: string) => Promise<void>
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'ok'; text: ReactNode }
  | { kind: 'error'; text: string }

const PRESET_CHOICES: readonly Choice<PresetId>[] = PRESETS.map((p) => ({
  value: p.id,
  title: p.title,
  sub: p.sub,
  leading: <HostTile tile={p.tile} host={p.host} size={28} />
}))

function scopeList(scopes: readonly string[]): ReactNode {
  return scopes.map((scope, i) => (
    <span key={scope}>
      {i > 0 ? (i === scopes.length - 1 ? ' and ' : ', ') : ''}
      <code>{scope}</code>
    </span>
  ))
}

export function IntegrationsSection({
  accounts,
  secureStorage,
  onAdded,
  onRemove
}: IntegrationsSectionProps) {
  const [presetId, setPresetId] = useState<PresetId>('github')
  const [label, setLabel] = useState('GitHub')
  const [labelTouched, setLabelTouched] = useState(false)
  const [baseUrlInput, setBaseUrlInput] = useState('')
  const [token, setToken] = useState('')
  const [allowInsecure, setAllowInsecure] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const preset = presetOf(presetId)
  const baseUrl = preset.fixedBaseUrl ?? tryNormalize(preset.type, baseUrlInput)
  const host = baseUrl ? hostnameOf(baseUrl) : ''
  const customHost = preset.fixedBaseUrl === null
  const busy = status.kind === 'busy'
  const canSubmit = baseUrl !== null && token.trim() !== ''

  function input(): AccountInput {
    return {
      type: preset.type,
      label: label.trim() || host,
      baseUrl: baseUrl ?? '',
      token,
      allowInsecureTls: customHost && allowInsecure
    }
  }

  function choosePreset(id: PresetId): void {
    const next = presetOf(id)
    setPresetId(id)
    if (!labelTouched) setLabel(next.defaultLabel)
    if (next.fixedBaseUrl !== null) setAllowInsecure(false)
    setStatus({ kind: 'idle' })
  }

  async function test(): Promise<void> {
    setStatus({ kind: 'busy', text: 'Testing connection' })
    try {
      const user = await window.api.accounts.test(input())
      setStatus({
        kind: 'ok',
        text: (
          <>
            Connected as <b>{user.username}</b>
          </>
        )
      })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    }
  }

  async function add(): Promise<void> {
    setStatus({ kind: 'busy', text: 'Adding account' })
    try {
      const account = await window.api.accounts.add(input())
      onAdded(account)
      // Ready for another account: keep the host, drop the secret.
      setToken('')
      setStatus({ kind: 'ok', text: <>Added {account.label}.</> })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    }
  }

  async function createToken(): Promise<void> {
    if (!baseUrl) return
    try {
      await window.api.openExternal(tokenUrl(preset.type, baseUrl))
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    }
  }

  async function remove(account: Account): Promise<void> {
    setRemoveError(null)
    try {
      await onRemove(account.id)
      setConfirmRemove(null)
    } catch (err) {
      setRemoveError(errorMessage(err))
    }
  }

  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T): void => {
      setter(value)
      setStatus({ kind: 'idle' })
    }

  return (
    <div className={styles.section}>
      <p className={styles.lead}>
        Connect GitHub or GitLab with a personal access token, stored encrypted in your OS keychain.
      </p>

      {secureStorage === false ? (
        <p className={styles.notice} role="alert">
          <Icon name="alert" size="sm" />
          <span>
            Secure storage is not available on this computer, so a token cannot be saved. You can
            still test a connection.
          </span>
        </p>
      ) : null}

      {accounts.length > 0 ? (
        <section className={styles.group} aria-label="Connected accounts">
          <h3 className={styles.sectionTitle}>Connected accounts</h3>
          <ul className={styles.accounts}>
            {accounts.map((account) => {
              const { tile, host: kind } = hostTileOf(account.type, account.baseUrl)
              return (
                <li key={account.id} className={styles.account}>
                  <HostTile tile={tile} host={kind} size={28} />
                  <span className={styles.accountText}>
                    <span className={styles.accountName}>{account.label}</span>
                    <span className={styles.accountSub}>
                      {account.username} · {account.host}
                    </span>
                  </span>
                  {confirmRemove === account.id ? (
                    <span className={styles.confirm}>
                      <Button onClick={() => setConfirmRemove(null)}>Keep</Button>
                      <Button onClick={() => void remove(account)}>Remove account</Button>
                    </span>
                  ) : (
                    <IconButton
                      label={`Remove ${account.label}`}
                      icon="trash"
                      onClick={() => {
                        setRemoveError(null)
                        setConfirmRemove(account.id)
                      }}
                    />
                  )}
                  {confirmRemove === account.id ? (
                    <span className={styles.confirmText}>
                      Removes the token, cached repositories and local links of {account.label} from
                      this computer. Your projects stay.
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {removeError ? (
            <p className={styles.errorText} role="alert">
              <Icon name="alert" size="sm" />
              {removeError}
            </p>
          ) : null}
          <h3 className={styles.sectionTitle}>Add another account</h3>
        </section>
      ) : null}

      <ChoiceGroup label="Host" value={presetId} options={PRESET_CHOICES} onChange={choosePreset} />

      <Field label="Label">
        {(control) => (
          <TextInput
            {...control}
            data-autofocus
            value={label}
            placeholder={host || 'Acme GitLab'}
            onChange={(e) => {
              setLabelTouched(true)
              edit(setLabel)(e.target.value)
            }}
          />
        )}
      </Field>

      <Field
        label="Base URL"
        hint={
          customHost
            ? 'The address you open in the browser, for example https://gitlab.acme.dev.'
            : undefined
        }
        error={
          customHost && baseUrlInput.trim() !== '' && baseUrl === null
            ? 'Enter a web address that starts with http:// or https://.'
            : null
        }
      >
        {(control) => (
          <TextInput
            {...control}
            value={preset.fixedBaseUrl ?? baseUrlInput}
            disabled={!customHost}
            placeholder="https://git.example.com"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => edit(setBaseUrlInput)(e.target.value)}
          />
        )}
      </Field>

      <Field
        label="Access token"
        action={
          <Button
            variant="ghost"
            icon="external"
            onClick={() => void createToken()}
            disabled={!baseUrl}
          >
            Create token
          </Button>
        }
        hint={<>Needs the {scopeList(TOKEN_SCOPES[preset.type])} scopes.</>}
      >
        {(control) => (
          <TextInput
            {...control}
            type="password"
            value={token}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => edit(setToken)(e.target.value)}
          />
        )}
      </Field>

      {customHost ? (
        <CheckOption
          label="Allow self-signed certificate for this host"
          checked={allowInsecure}
          onChange={edit(setAllowInsecure)}
          warning={
            <>
              Only enable this for hosts you trust. It applies to {host || 'this host'} only.
              Certificates from your company CA already work through the system store.
            </>
          }
        />
      ) : null}

      {status.kind !== 'idle' ? (
        <p
          className={`${styles.status} ${styles[status.kind]}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          <Icon
            name={status.kind === 'ok' ? 'check' : status.kind === 'error' ? 'alert' : 'refresh'}
          />
          <span>{status.kind === 'busy' ? `${status.text}…` : status.text}</span>
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button onClick={() => void test()} disabled={!canSubmit || busy}>
          Test connection
        </Button>
        <Button
          variant="primary"
          onClick={() => void add()}
          disabled={!canSubmit || busy || secureStorage === false}
        >
          Add account
        </Button>
      </div>
    </div>
  )
}
