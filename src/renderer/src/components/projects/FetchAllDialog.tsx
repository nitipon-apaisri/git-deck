import type { FetchAllState } from '../../lib/fetchAll'
import { fetchTotals, fetchTotalsText } from '../../lib/fetchAll'
import { Button, Dialog, Icon, ProgressBar, Spinner } from '../ui'
import styles from './FetchAllDialog.module.css'

interface FetchAllDialogProps {
  state: FetchAllState
  onClose: () => void
}

/** The per-repository result of "Fetch all linked". */
export function FetchAllDialog({ state, onClose }: FetchAllDialogProps) {
  const totals = fetchTotals(state)
  const percent = totals.total === 0 ? 0 : ((totals.done + totals.failed) / totals.total) * 100
  return (
    <Dialog
      title="Fetch all linked"
      description="Runs git fetch in the local folder of each repository in this project."
      onClose={onClose}
      actions={
        <Button variant="primary" onClick={onClose}>
          {totals.finished ? 'Done' : 'Close'}
        </Button>
      }
    >
      <div className={styles.summary} aria-live="polite">
        <span>{fetchTotalsText(totals)}</span>
        {!totals.finished ? <span className={styles.note}>Closing stops the queue.</span> : null}
      </div>
      <ProgressBar percent={percent} label="Fetch progress" />
      <ul className={styles.list}>
        {state.items.map((item) => (
          <li key={item.key} className={styles.item}>
            <span className={styles.mark}>
              {item.status === 'running' ? <Spinner label={`Fetching ${item.name}`} /> : null}
              {item.status === 'done' ? (
                <span className={styles.done}>
                  <Icon name="check" size="sm" label="Fetched" />
                </span>
              ) : null}
              {item.status === 'failed' ? (
                <span className={styles.failed}>
                  <Icon name="alert" size="sm" label="Failed" />
                </span>
              ) : null}
              {item.status === 'queued' ? <span className={styles.queued}>Waiting</span> : null}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{item.name}</span>
              {item.error ? <span className={styles.error}>{item.error}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
