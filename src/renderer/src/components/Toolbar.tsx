import type { Account } from '@shared/types'
import { hostTileOf } from '../lib/presets'
import { HostTile, Icon } from './ui'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  accounts: Account[]
  onOpenAccounts: () => void
}

export function Toolbar({ accounts, onOpenAccounts }: ToolbarProps) {
  const names = accounts.map((a) => a.label).join(', ')
  return (
    <header className={styles.toolbar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="git-branch" size="sm" />
        </span>
        <span className={styles.name}>GitDeck</span>
      </div>
      <span className={styles.spacer} />
      {accounts.length > 0 ? (
        <button
          type="button"
          className={styles.accounts}
          onClick={onOpenAccounts}
          aria-label={`Accounts: ${names}. Open accounts`}
          title="Accounts"
        >
          {accounts.map((account) => {
            const { tile, host } = hostTileOf(account.type, account.baseUrl)
            return (
              <span key={account.id} className={styles.stacked}>
                <HostTile tile={tile} host={host} size={24} />
              </span>
            )
          })}
        </button>
      ) : null}
    </header>
  )
}
