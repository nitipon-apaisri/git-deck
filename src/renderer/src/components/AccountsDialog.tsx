import { useEffect, useState } from 'react'
import type { Account } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { PRESETS, tokenPageUrl } from '../lib/presets'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

interface Props {
  accounts: Account[]
  onClose: () => void
  onAdded: (account: Account) => void
  onRemoved: (id: string) => void
}

type Status = { kind: 'ok' | 'error'; text: string } | null

export function AccountsDialog({ accounts, onClose, onAdded, onRemoved }: Props): React.JSX.Element {
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState(preset.baseUrl)
  const [token, setToken] = useState('')
  const [insecure, setInsecure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [secure, setSecure] = useState(true)

  useEffect(() => {
    void window.api.secureStorageAvailable().then(setSecure)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const choosePreset = (id: string): void => {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
    setPresetId(id)
    setBaseUrl(p.baseUrl)
    if (p.fixedUrl) setInsecure(false)
    setStatus(null)
  }

  const input = { type: preset.type, label, baseUrl, token, allowInsecureTls: !preset.fixedUrl && insecure }
  const canSubmit = !busy && token.trim() !== '' && (preset.fixedUrl || baseUrl.trim() !== '')

  const test = async (): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const user = await window.api.accounts.test(input)
      setStatus({ kind: 'ok', text: `Connected as ${user.username}` })
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const add = async (): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const account = await window.api.accounts.add(input)
      onAdded(account)
      setToken('')
      setLabel('')
      setStatus({ kind: 'ok', text: `Added ${account.username}` })
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const createToken = (): void => {
    const url = tokenPageUrl(preset.type, baseUrl)
    if (!url) setStatus({ kind: 'error', text: 'Enter a valid server URL first' })
    else void window.api.openExternal(url)
  }

  const remove = async (a: Account): Promise<void> => {
    if (!window.confirm(`Remove ${a.label} (${a.username})? Its token, cache and local links are deleted.`)) return
    try {
      await window.api.accounts.remove(a.id)
      onRemoved(a.id)
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label="Accounts" onMouseDown={(e) => e.stopPropagation()}>
        <header className="dialog-head">
          <h2>Accounts</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>

        {!secure && (
          <div className="banner banner-warn">
            <Icon name="alert" /> Secure storage is unavailable on this system, so tokens cannot be saved.
          </div>
        )}

        {accounts.length > 0 && (
          <ul className="account-list">
            {accounts.map((a) => (
              <li key={a.id}>
                <Avatar name={a.username} url={a.avatarUrl} size={24} />
                <div className="account-meta">
                  <strong>{a.label}</strong>
                  <span className="muted">
                    {a.username} · {a.host}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => void remove(a)} aria-label={`Remove ${a.label}`}>
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) void add()
          }}
        >
          <h3>Connect an account</h3>
          <div className="chips">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`chip${p.id === presetId ? ' chip-active' : ''}`}
                onClick={() => choosePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label>
            Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={preset.label} />
          </label>
          <label>
            Server URL
            <input
              value={baseUrl}
              disabled={preset.fixedUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://git.example.com"
              spellCheck={false}
            />
          </label>
          <label>
            Access token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <p className="muted hint">
            {preset.type === 'github'
              ? 'Classic token with the repo scope, or fine-grained with read access to metadata and contents.'
              : 'Scopes needed: read_api and read_repository.'}
          </p>
          {!preset.fixedUrl && (
            <label className="check">
              <input type="checkbox" checked={insecure} onChange={(e) => setInsecure(e.target.checked)} />
              Allow self-signed certificate for this host
            </label>
          )}

          {status && (
            <div className={`banner ${status.kind === 'ok' ? 'banner-ok' : 'banner-error'}`}>
              <Icon name={status.kind === 'ok' ? 'check' : 'alert'} /> {status.text}
            </div>
          )}

          <div className="actions">
            <button type="button" className="btn" onClick={createToken}>
              <Icon name="external" /> Create token
            </button>
            <span className="spacer" />
            <button type="button" className="btn" disabled={!canSubmit} onClick={() => void test()}>
              Test connection
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit || !secure}>
              {busy ? 'Working…' : 'Add account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
