import type { Account } from '@shared/types'
import { hostTileOf } from '../lib/presets'
import type { Orientation } from '../lib/splitState'
import { HostTile, IconButton } from './ui'

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
    <header
      className="flex h-[var(--toolbar-height)] flex-none items-center gap-2 px-3 data-[inset=true]:pl-[var(--titlebar-inset)] [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]"
      data-inset={insetTitleBar ? 'true' : undefined}
    >
      <span className="flex-1" />
      <div className="mr-2 flex items-center gap-1" role="group" aria-label="Split view">
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
          className="group/accounts flex cursor-pointer items-center rounded-md border-0 bg-transparent p-1 hover:bg-accent"
          onClick={onOpenAccounts}
          aria-label={`Accounts: ${names}. Open accounts`}
          title="Accounts"
        >
          {accounts.map((account) => {
            const { tile, host } = hostTileOf(account.type, account.baseUrl)
            return (
              <span
                key={account.id}
                className="inline-flex rounded-md border-2 border-[var(--window)] not-first:-ml-1.5 group-hover/accounts:border-[var(--hover)]"
              >
                <HostTile tile={tile} host={host} size={24} />
              </span>
            )
          })}
        </button>
      ) : null}
    </header>
  )
}
