import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { diffRepoKeys, replaceProject, type ProjectFormValue } from '../lib/projectForm'

export interface Projects {
  projects: Project[]
  /** The list has been read from main, so "no projects" is real. */
  ready: boolean
  loadError: string | null
  /** Re-reads the list, for example after an account was removed (main drops its repos). */
  reload: () => Promise<void>
  /** Creates (`id` null) or edits, including the repository changes. Rejects with a message. */
  save: (id: string | null, value: ProjectFormValue) => Promise<Project>
  remove: (id: string) => Promise<void>
  addRepos: (id: string, repoKeys: string[]) => Promise<void>
  removeRepos: (id: string, repoKeys: string[]) => Promise<void>
}

/** The projects stored by main. Every change goes through main and comes back as data. */
export function useProjects(): Projects {
  const [projects, setProjects] = useState<Project[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const latest = useRef(projects)
  useEffect(() => {
    latest.current = projects
  })

  const reload = useCallback(async () => {
    try {
      setProjects(await window.api.projects.list())
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessage(err))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await window.api.projects.list()
        if (!cancelled) setProjects(list)
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err))
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const put = useCallback((project: Project) => {
    latest.current = replaceProject(latest.current, project)
    setProjects(latest.current)
  }, [])

  const save = useCallback(
    async (id: string | null, value: ProjectFormValue): Promise<Project> => {
      try {
        if (id === null) {
          const created = await window.api.projects.create({
            name: value.name,
            icon: value.icon,
            color: value.color,
            repoKeys: value.repoKeys
          })
          put(created)
          return created
        }
        const current = latest.current.find((p) => p.id === id)
        if (!current) throw new Error('Project not found')
        let project = await window.api.projects.update(id, {
          name: value.name,
          icon: value.icon,
          color: value.color
        })
        put(project)
        const { add, remove } = diffRepoKeys(current.repoKeys, value.repoKeys)
        if (add.length > 0) {
          project = await window.api.projects.addRepos(id, add)
          put(project)
        }
        if (remove.length > 0) {
          project = await window.api.projects.removeRepos(id, remove)
          put(project)
        }
        return project
      } catch (err) {
        throw new Error(errorMessage(err), { cause: err })
      }
    },
    [put]
  )

  const remove = useCallback(async (id: string) => {
    try {
      await window.api.projects.remove(id)
    } catch (err) {
      throw new Error(errorMessage(err), { cause: err })
    }
    latest.current = latest.current.filter((p) => p.id !== id)
    setProjects(latest.current)
  }, [])

  const addRepos = useCallback(
    async (id: string, repoKeys: string[]) => {
      try {
        put(await window.api.projects.addRepos(id, repoKeys))
      } catch (err) {
        throw new Error(errorMessage(err), { cause: err })
      }
    },
    [put]
  )

  const removeRepos = useCallback(
    async (id: string, repoKeys: string[]) => {
      try {
        put(await window.api.projects.removeRepos(id, repoKeys))
      } catch (err) {
        throw new Error(errorMessage(err), { cause: err })
      }
    },
    [put]
  )

  return { projects, ready, loadError, reload, save, remove, addRepos, removeRepos }
}
