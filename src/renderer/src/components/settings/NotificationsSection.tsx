import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/errors'
import { Button, CheckOption, ErrorBanner } from '../ui'

/** The app-wide switch for PR/MR notifications, and a test notification. */
export function NotificationsSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.notify.enabled().then(setEnabled, (err: unknown) => setError(errorMessage(err)))
  }, [])

  async function choose(on: boolean): Promise<void> {
    setError(null)
    try {
      await window.api.notify.setEnabled(on)
      setEnabled(on)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function test(): Promise<void> {
    setError(null)
    setStatus(null)
    try {
      const problem = await window.api.notify.test()
      if (problem) setError(problem)
      else setStatus('Sent. It should be on screen or in Notification Center.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] leading-5 text-muted-foreground">
        While GitDeck is open, it checks the pull and merge requests of projects that turned events
        on in Edit project, every 2 minutes. A notification shows the host and repository name only.
      </p>
      {enabled === null ? null : (
        <CheckOption
          label="Allow notifications"
          checked={enabled}
          onChange={(on) => void choose(on)}
          warning={enabled ? undefined : 'Off: nothing is checked, whatever projects ask for.'}
        />
      )}
      <div className="flex items-center gap-3">
        <Button icon="bell" onClick={() => void test()}>
          Send a test notification
        </Button>
      </div>
      {status ? (
        <p className="m-0 text-[13px] leading-5 text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
    </div>
  )
}
