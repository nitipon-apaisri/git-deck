// Channel to handler table and the result envelope. No electron import, so a test
// can prove every channel is wired.
import { IPC, type IpcResult } from '../shared/api'
import type { CloneProtocol, ProjectCreateInput, ProjectPatchInput } from '../shared/api'
import type {
  AccountInput,
  BisectMark,
  CheckoutTarget,
  DiffRequest,
  ConflictAction,
  ConflictRequest,
  HunkRequest,
  RebaseTodoItem,
  PullMode,
  BranchDeleteItem,
  ResetMode,
  CreateChangeRequestInput
} from '../shared/types'
import type { AiConfig, AiProviderId } from '../shared/ai'
import type { MainApi } from './service'

export type Handler = (args: unknown[]) => Promise<unknown>

export type RequestChannel = Exclude<
  keyof typeof IPC,
  'gitProgress' | 'repoChanged' | 'terminalData' | 'terminalExit' | 'notifyOpen' | 'inboxChanged'
>

// The casts mark the trust boundary: the service validates every argument at runtime.
export function buildHandlers(api: MainApi): Record<RequestChannel, Handler> {
  return {
    secureStorageAvailable: () => api.secureStorageAvailable(),
    terminalCreate: ([path, cols, rows]) =>
      api.terminal.create(path as string, cols as number, rows as number),
    terminalWrite: ([id, data]) => api.terminal.write(id as string, data as string),
    terminalResize: ([id, cols, rows]) =>
      api.terminal.resize(id as string, cols as number, rows as number),
    terminalKill: ([id]) => api.terminal.kill(id as string),
    accountsList: () => api.accounts.list(),
    accountsTest: ([input]) => api.accounts.test(input as AccountInput),
    accountsAdd: ([input]) => api.accounts.add(input as AccountInput),
    accountsRemove: ([id]) => api.accounts.remove(id as string),
    reposCached: ([id]) => api.repos.cached(id as string),
    reposFetch: ([id]) => api.repos.fetch(id as string),
    summaryCached: ([key]) => api.summary.cached(key as string),
    summaryFetch: ([key]) => api.summary.fetch(key as string),
    changesList: ([key]) => api.changes.list(key as string),
    changesChecks: ([key, ref]) => api.changes.checks(key as string, ref as string),
    changesCreate: ([key, input]) =>
      api.changes.create(key as string, input as CreateChangeRequestInput),
    localLinks: () => api.local.links(),
    localLink: ([key]) => api.local.link(key as string),
    localUnlink: ([key]) => api.local.unlink(key as string),
    localClone: ([key, protocol]) => api.local.clone(key as string, protocol as CloneProtocol),
    localInfo: ([path]) => api.local.info(path as string),
    localGraph: ([path, skip, limit]) =>
      api.local.graph(path as string, skip as number, limit as number),
    localCommit: ([path, hash]) => api.local.commit(path as string, hash as string),
    localFetch: ([path]) => api.local.fetch(path as string),
    localWatch: ([path]) => api.local.watch(path as string),
    localUnwatch: ([path]) => api.local.unwatch(path as string),
    localReveal: ([path]) => api.local.reveal(path as string),
    localStatus: ([path]) => api.local.status(path as string),
    localFileHistory: ([path, file, page]) =>
      api.local.fileHistory(path as string, file as string, page as number),
    localBlame: ([path, file, rev]) =>
      api.local.blame(path as string, file as string, rev as string | null),
    localDiff: ([path, request]) => api.local.diff(path as string, request as DiffRequest),
    localStage: ([path, files]) => api.local.stage(path as string, files as string[]),
    localUnstage: ([path, files]) => api.local.unstage(path as string, files as string[]),
    localStageAll: ([path]) => api.local.stageAll(path as string),
    localDiscard: ([path, files]) => api.local.discard(path as string, files as string[]),
    localCreateCommit: ([path, message, amend]) =>
      api.local.createCommit(path as string, message as string, amend as boolean),
    localBranches: ([path]) => api.local.branches(path as string),
    localCheckout: ([path, target]) => api.local.checkout(path as string, target as CheckoutTarget),
    localCreateBranch: ([path, name, startPoint, checkout]) =>
      api.local.createBranch(
        path as string,
        name as string,
        startPoint as string | null,
        checkout as boolean
      ),
    localRenameBranch: ([path, from, to]) =>
      api.local.renameBranch(path as string, from as string, to as string),
    localDeleteBranch: ([path, name]) => api.local.deleteBranch(path as string, name as string),
    localDeleteRemoteBranch: ([path, name]) =>
      api.local.deleteRemoteBranch(path as string, name as string),
    localDeleteBranches: ([path, items, force]) =>
      api.local.deleteBranches(path as string, items as BranchDeleteItem[], force as boolean),
    localPushBranch: ([path, name]) => api.local.pushBranch(path as string, name as string),
    localFastForwardBranch: ([path, name]) =>
      api.local.fastForwardBranch(path as string, name as string),
    localPull: ([path, mode]) => api.local.pull(path as string, mode as PullMode),
    localPush: ([path, force]) => api.local.push(path as string, force as boolean),
    localSuggestCommitMessage: ([path, config]) =>
      api.local.suggestCommitMessage(path as string, config as AiConfig),
    localStashes: ([path]) => api.local.stashes(path as string),
    localStashPush: ([path, message, untracked]) =>
      api.local.stashPush(path as string, message as string, untracked as boolean),
    localStashApply: ([path, index, hash]) =>
      api.local.stashApply(path as string, index as number, hash as string),
    localStashPop: ([path, index, hash]) =>
      api.local.stashPop(path as string, index as number, hash as string),
    localStashDrop: ([path, index, hash]) =>
      api.local.stashDrop(path as string, index as number, hash as string),
    localCherryPick: ([path, hash]) => api.local.cherryPick(path as string, hash as string),
    localMerge: ([path, branch, noFf]) =>
      api.local.merge(path as string, branch as string, noFf as boolean),
    localTags: ([path]) => api.local.tags(path as string),
    localCreateTag: ([path, name, hash, message]) =>
      api.local.createTag(
        path as string,
        name as string,
        hash as string | null,
        message as string | null
      ),
    localDeleteTag: ([path, name]) => api.local.deleteTag(path as string, name as string),
    localPushTag: ([path, name]) => api.local.pushTag(path as string, name as string),
    localDeleteRemoteTag: ([path, name]) =>
      api.local.deleteRemoteTag(path as string, name as string),
    localRevert: ([path, hash]) => api.local.revert(path as string, hash as string),
    localReset: ([path, hash, mode]) =>
      api.local.reset(path as string, hash as string, mode as ResetMode),
    localRemotes: ([path]) => api.local.remotes(path as string),
    localAddRemote: ([path, name, url]) =>
      api.local.addRemote(path as string, name as string, url as string),
    localRenameRemote: ([path, from, to]) =>
      api.local.renameRemote(path as string, from as string, to as string),
    localRemoveRemote: ([path, name]) => api.local.removeRemote(path as string, name as string),
    localRebase: ([path, onto]) => api.local.rebase(path as string, onto as string),
    localRebasePlan: ([path, base]) => api.local.rebasePlan(path as string, base as string),
    localRebaseRun: ([path, base, todo]) =>
      api.local.rebaseRun(path as string, base as string, todo as RebaseTodoItem[]),
    localSkipOperation: ([path]) => api.local.skipOperation(path as string),
    localStageHunk: ([path, hunk]) => api.local.stageHunk(path as string, hunk as HunkRequest),
    localUnstageHunk: ([path, hunk]) => api.local.unstageHunk(path as string, hunk as HunkRequest),
    localDiscardLines: ([path, hunk]) =>
      api.local.discardLines(path as string, hunk as HunkRequest),
    localConflictFile: ([path, file]) => api.local.conflictFile(path as string, file as string),
    localResolveConflict: ([path, request]) =>
      api.local.resolveConflict(path as string, request as ConflictRequest),
    localResolveConflictFile: ([path, file, action]) =>
      api.local.resolveConflictFile(path as string, file as string, action as ConflictAction),
    localOperation: ([path]) => api.local.operation(path as string),
    localBisect: ([path]) => api.local.bisect(path as string),
    localBisectStart: ([path, bad, good]) =>
      api.local.bisectStart(path as string, bad as string, good as string),
    localBisectMark: ([path, mark]) => api.local.bisectMark(path as string, mark as BisectMark),
    localBisectReset: ([path]) => api.local.bisectReset(path as string),
    localContinueOperation: ([path]) => api.local.continueOperation(path as string),
    localAbortOperation: ([path]) => api.local.abortOperation(path as string),
    localRepos: () => api.local.repos(),
    localOpen: () => api.local.open(),
    localRemove: ([key]) => api.local.remove(key as string),
    openExternal: ([url]) => api.openExternal(url as string),
    checkForUpdate: () => api.checkForUpdate(),
    releaseNotes: () => api.releaseNotes(),
    aiSaveKey: ([provider, key]) => api.ai.saveKey(provider as AiProviderId, key as string),
    aiRemoveKey: ([provider]) => api.ai.removeKey(provider as AiProviderId),
    aiHasKey: ([provider]) => api.ai.hasKey(provider as AiProviderId),
    aiTest: ([config]) => api.ai.test(config as AiConfig),
    notifyEnabled: () => api.notify.enabled(),
    notifySetEnabled: ([on]) => api.notify.setEnabled(on as boolean),
    notifyTest: () => api.notify.test(),
    inboxList: () => api.inbox.list(),
    inboxMarkRead: ([id]) => api.inbox.markRead(id as string),
    inboxMarkAllRead: () => api.inbox.markAllRead(),
    projectsList: () => api.projects.list(),
    projectsCreate: ([input]) => api.projects.create(input as ProjectCreateInput),
    projectsUpdate: ([id, patch]) => api.projects.update(id as string, patch as ProjectPatchInput),
    projectsRemove: ([id]) => api.projects.remove(id as string),
    projectsAddRepos: ([id, keys]) => api.projects.addRepos(id as string, keys as string[]),
    projectsRemoveRepos: ([id, keys]) => api.projects.removeRepos(id as string, keys as string[])
  }
}

export async function respond(handler: Handler, args: unknown[]): Promise<IpcResult<unknown>> {
  try {
    return { ok: true, value: await handler(args) }
  } catch (err) {
    // The service already scrubbed the message. Never send a stack.
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
