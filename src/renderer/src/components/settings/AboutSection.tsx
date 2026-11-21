import { useState } from 'react'
import type { UpdateCheck } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { Button, ErrorBanner } from '../ui'

/** Manual update check against the latest GitHub release. Nothing runs at launch. */
export function AboutSection() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<UpdateCheck | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setResult(await window.api.checkForUpdate())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] leading-5 text-muted-foreground">
        GitDeck does not update itself and never checks on launch. Press the button to ask GitHub
        for the latest release.
      </p>
      <div className="flex items-center gap-3">
        <Button icon="refresh" disabled={busy} onClick={() => void check()}>
          Check for updates
        </Button>
        {result ? (
          <span className="text-[13px] text-muted-foreground" role="status">
            {result.latest ? `Installed ${result.current}` : `Up to date (${result.current})`}
          </span>
        ) : null}
      </div>
      {error ? <ErrorBanner>Could not check for updates: {error}</ErrorBanner> : null}
      {result?.latest ? (
        <div className="flex items-center gap-3 rounded-md bg-card px-3 py-2" role="status">
          <span className="min-w-0 flex-1 text-[13px]">
            Version {result.latest.version} is out.
          </span>
          <Button
            variant="primary"
            icon="download"
            onClick={() => void window.api.openExternal(result.latest!.url)}
          >
            Download
          </Button>
        </div>
      ) : null}
    </div>
  )
}
