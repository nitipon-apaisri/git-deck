import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/errors'
import { Button, SwitchOption } from '../ui'

/** The app-wide switch for PR/MR notifications, and a test notification. */
export function NotificationsSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    window.api.notify.enabled().then(setEnabled, (err: unknown) => setResult(errorMessage(err)))
  }, [])

  async function choose(on: boolean): Promise<void> {
    setResult(null)
    try {
      await window.api.notify.setEnabled(on)
      setEnabled(on)
    } catch (err) {
      setResult(errorMessage(err))
    }
  }

  async function test(): Promise<void> {
    setSending(true)
    setResult('Sending…')
    try {
      const problem = await window.api.notify.test()
      setResult(problem ?? 'Sent. If you saw nothing, check Focus mode or Notification Center.')
    } catch (err) {
      setResult(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {enabled === null ? null : (
        <SwitchOption
          label="Allow notifications"
          checked={enabled}
          onChange={(on) => void choose(on)}
        />
      )}
      <p className="m-0 text-[13px] leading-5 text-muted-foreground">
        While GitDeck is open, it checks the pull and merge requests of projects that turned events
        on in Edit project, every 2 minutes. A notification shows the host and repository name only.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button icon="bell" disabled={sending || !enabled} onClick={() => void test()}>
          Send a test notification
        </Button>
        <small
          className="min-w-0 flex-[1_1_180px] text-[12px] leading-5 text-muted-foreground"
          role="status"
        >
          {enabled === false ? 'Notifications are off.' : result}
        </small>
      </div>
    </div>
  )
}
