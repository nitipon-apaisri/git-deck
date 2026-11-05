import { useCallback, useEffect, useReducer, useRef } from 'react'
import { errorMessage } from '../lib/errors'
import {
  emptyFetchAll,
  fetchAllReducer,
  type FetchAllState,
  type FetchTarget
} from '../lib/fetchAll'
import { runPool } from '../lib/pool'
import { FETCH_ALL_CONCURRENCY } from '../lib/projectRows'

export interface FetchAll {
  state: FetchAllState
  /** Starts from a click, not from an effect, so a double render never fetches twice. */
  start: (targets: FetchTarget[]) => void
  /** Hides the list. Fetches that already started finish; queued ones do not start. */
  close: () => void
}

/** `git fetch` in each linked folder of a project, two at a time. */
export function useFetchAll(): FetchAll {
  const [state, dispatch] = useReducer(fetchAllReducer, undefined, emptyFetchAll)
  const generation = useRef(0)

  useEffect(
    () => () => {
      generation.current += 1
    },
    []
  )

  const start = useCallback((targets: FetchTarget[]) => {
    generation.current += 1
    const gen = generation.current
    dispatch({ type: 'start', targets })
    void runPool(
      targets,
      async (target) => {
        if (gen !== generation.current) return
        dispatch({ type: 'running', key: target.key })
        try {
          await window.api.local.fetch(target.path)
          if (gen === generation.current) dispatch({ type: 'done', key: target.key })
        } catch (err) {
          if (gen === generation.current) {
            dispatch({ type: 'failed', key: target.key, error: errorMessage(err) })
          }
        }
      },
      { limit: FETCH_ALL_CONCURRENCY, cancelled: () => gen !== generation.current }
    )
  }, [])

  const close = useCallback(() => {
    generation.current += 1
    dispatch({ type: 'close' })
  }, [])

  return { state, start, close }
}
