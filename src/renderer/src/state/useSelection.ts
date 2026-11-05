import { useCallback, useState } from 'react'
import { readStored, writeStored } from './storage'

const KEY = 'gitdeck.selection'

export interface Selection {
  /** `accountId:remoteId` of the repository shown in the main island, if any. */
  selectedKey: string | null
  select: (repoKey: string | null) => void
}

/**
 * The one place that knows which repository is selected. The sidebar only calls
 * this hook, so Phase 8 can swap it for the split-layout state without touching it.
 */
export function useSelection(): Selection {
  const [selectedKey, setSelectedKey] = useState<string | null>(() => readStored(KEY))
  const select = useCallback((repoKey: string | null) => {
    setSelectedKey(repoKey)
    writeStored(KEY, repoKey)
  }, [])
  return { selectedKey, select }
}
