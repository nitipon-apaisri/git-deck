import type { Account } from '@shared/types'
import { hostTileOf } from '../lib/presets'
import type { Orientation } from '../lib/splitState'
import { HostTile, Icon, IconButton } from './ui'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  /** macOS: no native title bar, so leave room for the traffic lights. */
  insetTitleBar: boolean
  accounts: Account[]
  onOpenAccounts: () => void
  splitEnabled: boolean
  orientation: Orientation
  onToggleSplit: () => void
  onToggleOrientation: () => void
  onSwap: () => void
}

export function Toolbar({
  insetTitleBar,
  accounts,
  onOpenAccounts,
  splitEnabled,
  orientation,
  onToggleSplit,
  onToggleOrientation,
  onSwap
}: ToolbarProps) {
  const names = accounts.map((a) => a.label).join(', ')
  return (
    <header className={styles.toolbar} data-inset={insetTitleBar ? 'true' : undefined}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="git-branch" size="sm" />
        </span>
        <span className={styles.name}>GitDeck</span>
      </div>
      <span className={styles.spacer} />
      <div className={styles.split} role="group" aria-label="Split view">
        {splitEnabled ? (
          <>
            <IconButton
              label={
                orientation === 'horizontal'
                  ? 'Stack the panes on top of each other'
                  : 'Put the panes side by side'
              }
              icon="rotate"
              onClick={onToggleOrientation}
            />
            <IconButton label="Swap the panes" icon="swap" onClick={onSwap} />
          </>
        ) : null}
        <IconButton
          label="Split view (Ctrl/Cmd+Alt+S)"
          icon="columns"
          active={splitEnabled}
          aria-pressed={splitEnabled}
          onClick={onToggleSplit}
        />
      </div>
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
