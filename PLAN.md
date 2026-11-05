# GitDeck — build brief for Claude Code

You are building **GitDeck**, a desktop Git client in the spirit of GitKraken. It connects to GitHub, GitLab.com and self-hosted GitLab, lists the user's repos grouped by host, shows a summary per repo, and renders a commit graph from a local clone. It also supports **Projects** (named collections of repos from any host) and a **Split View** that shows two repos side by side.

Work through the phases below in order. If the user names a phase, do only that phase and stop after its Verify steps. Otherwise do not stop to ask for confirmation between phases. Ask only if something is genuinely ambiguous and cannot be resolved with the defaults in this file.

## How to work

- Build one phase at a time. At the end of each phase run its **Verify** steps, fix failures, then commit with a clear message and tick the phase's checkbox in this file.
- Keep dependencies minimal. Runtime deps are `react` and `react-dom` only. No UI kit, no state library, no native modules (no SQLite, no keytar). Persist with JSON files.
- Prefer small, typed, pure modules. Anything that does not need Electron must not import `electron`, so it can be tested in plain Node.
- Treat Electron GUI launch as unavailable if there is no display. Verify with typecheck, build and tests, and say clearly at the end what was not run visually.
- Never write secrets (tokens) to logs, error messages, or git config files.
- **Pane-safe UI.** Two repos can be on screen at once (Split View, Phase 8), so every repo-level component takes its repo as a prop and keeps its own state. No module-level singletons or global "current repo" in the renderer: the graph layout instance, the summary hook, scroll position, selected commit, clone progress, and the active tab all live inside the pane. Build it this way from Phase 5 on instead of retrofitting later.

## UI design (source of truth)

The visual design is already done. Do not invent colours, sizes or components. Read these before Phase 5:

- `docs/design-system/README.md`: usage rules (principles, colour, graph, type, spacing, projects, voice).
- `docs/design-system/tokens.json` and `tokens.css`: every colour (dark and light), type style, spacing, radius, shadow and shell size. `tokens.css` is the compiled form: dark in `:root, [data-theme="dark"]`, overrides in `[data-theme="light"]`.
- `docs/design-system/components/<Name>/README.md` and `preview.html`: guidelines and a live reference for Island, Button, Field, TreeRow, RefBadge, GraphRow, ProjectIcon, StatCard, Dialog. Open the previews in a browser to see the target.
- `docs/ui-boards/`: the full-screen boards (Main, Split, Project, plus the Accounts and Project dialogs, each in dark and light) as markup. They are templates with `sc-for` loops and a `./support.js` runtime that is not included, so read them as HTML and CSS reference, not as pages that run.

Rules for the renderer:

- Copy `docs/design-system/tokens.css` to `src/renderer/src/tokens.css` and import it once. Style only with `var(--token)`. No hex values in components or CSS modules except inside `tokens.css`.
- Theme is a `data-theme="dark" | "light"` attribute on `<html>`. Add a setting System / Dark / Light (default System, via `prefers-color-scheme`), persisted in localStorage as `gitdeck.theme`. Set the attribute before first paint to avoid a flash.
- Fonts: Inter for the interface and JetBrains Mono for hashes and paths. Install `@fontsource/inter` and `@fontsource/jetbrains-mono` as **devDependencies** and import their CSS in the renderer, so Vite bundles the `woff2` files into the app (runtime deps stay `react` and `react-dom`). The CSP must not allow remote fonts.
- Shell: 48 px toolbar, 40 px icon rail, 300 px sidebar, all as islands on the `window` ground with a 6 px gap. Tree rows 30 px, graph rows 28 px, graph lane 16 px.
- Keep the design-system components as real React components in `src/renderer/src/components/ui/` (`Island`, `Button`, `IconButton`, `Field`, `TreeRow`, `RefBadge`, `ProjectIcon`, `StatCard`, `Dialog`, `Avatar`) and use them everywhere, so a token change restyles the whole app.
- All status uses a word or icon as well as colour. Focus is a solid 2 px `--focus-ring` outline. Icon-only buttons have `aria-label`.
- Both themes must be checked: when a display is available, screenshot each main screen in dark and light.

## Stack and versions

Check each version with `pnpm view <pkg> version` before pinning. Known good at planning time:

| Package              | Version                                  |
| -------------------- | ---------------------------------------- |
| electron             | ^44                                      |
| electron-vite        | ^6 (rolldown based, needs Node >= 22.12) |
| vite                 | ^8                                       |
| @vitejs/plugin-react | ^6                                       |
| react / react-dom    | ^19                                      |
| typescript           | ~5.9 (do not use 7.x yet)                |
| tsx                  | ^4 (tests only)                          |

Install with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install` in headless or sandboxed environments.

Pitfalls to check against the installed docs/types rather than memory:

- electron-vite 6 config API. Read `node_modules/electron-vite` README and types. The older `externalizeDepsPlugin` may be deprecated or changed.
- Do **not** set `"type": "module"` in package.json. Main and preload must build to CommonJS so the preload works with `sandbox: true`.
- Renderer CSP is set with a `<meta>` tag. In dev, Vite injects inline scripts for React refresh, so add a tiny Vite plugin that strips the CSP meta tag when `ctx.server` is present (dev only).
- Use two tsconfigs (`tsconfig.node.json` for main/preload/shared, `tsconfig.web.json` for renderer/shared), with a root `tsconfig.json` that only references them. Scripts: `typecheck:node`, `typecheck:web`, `typecheck`.
- Shared code and the main process use **relative imports**. The renderer may use an `@shared` alias. This keeps `tsx` tests working without path mapping.

## Project layout

```
src/
  main/
    index.ts            app lifecycle, window, security settings
    ipc.ts              all ipcMain handlers
    store.ts            accounts, tokens, links, cache (JSON files)
    http.ts             injectable fetch, getJson, paginate, parseLink, countItems
    tls.ts              per-host insecure TLS allowlist + cert verify proc
    gitAuth.ts          env vars that give git an auth header for one host
    git.ts              local git service (no electron imports)
    providers/
      types.ts          GitProvider interface
      github.ts
      gitlab.ts
      index.ts          createProvider(account, token)
  preload/index.ts      contextBridge, exposes window.api
  shared/
    types.ts            domain types
    api.ts              IPC contract (Api interface)
    graph-layout.ts     lane assignment algorithm (pure)
    projects.ts         project helpers + aggregation (pure)
  renderer/
    index.html
    src/                main.tsx, App.tsx, styles.css, components/, lib/
                        components/: Sidebar, AccountsDialog, RepoPane, SplitView,
                                     ProjectOverview, ProjectsDialog, GitGraph, ...
                        lib/: splitState.ts (pure reducer), hooks, formatting helpers
tests/                  node:test files run through tsx
README.md
```

## Domain types (src/shared/types.ts)

- `Account`: `id, type ('github'|'gitlab'), label, baseUrl, host, username, avatarUrl?, allowInsecureTls`
- `AccountInput`: `type, label, baseUrl, token, allowInsecureTls`
- `Repo`: `key (accountId:remoteId), accountId, remoteId, name, fullName, namespace, description, visibility ('public'|'private'|'internal'), defaultBranch, webUrl, httpUrl, sshUrl, stars, forks, openIssues, updatedAt, archived, fork`
- `Contributor`: `name, login, email, avatarUrl, commits`
- `RepoSummary`: `commitCount, contributorCount, contributors[], branchCount, tagCount, openChangeRequests, languages[{name, percent}], license, createdAt, lastActivityAt, sizeKb, topics[]`. Counts are `number | null` (null means unknown).
- `Cached<T>`: `{ data, fetchedAt }`
- `GraphRef`: `{ name, kind: 'head'|'branch'|'remote'|'tag', current? }`
- `GraphCommit`: `hash, parents[], author, email, date (unix seconds), refs: GraphRef[], subject`
- `CommitDetail`: `hash, body, files[{path, additions|null, deletions|null}]` (null = binary)
- `LocalInfo`: path, currentBranch, headHash, detached, remotes[{name,url}] (credentials stripped from URLs), localBranches, remoteBranches, tags, latestTags[], commitCount, firstCommitAt, lastCommitAt, dirtyFiles, ahead, behind, sizeKb

## Project types (src/shared/types.ts)

- `Project`: `id, name, icon, color, repoKeys: string[], createdAt, updatedAt`. `icon` is either a built-in icon id (about 30 feather-style SVG icons such as `folder`, `rocket`, `server`, `layers`) or a single emoji; `color` is one of 8 palette ids. A repo key is `accountId:remoteId`. A project can hold repos from several accounts and hosts at once (for example a GitHub repo and a self-hosted GitLab repo).
- `ProjectSummary` (computed in the renderer by `shared/projects.ts`, never stored): `repoCount, loadedCount, commits, contributors, openChangeRequests, lastActivityAt, partial: boolean`. `partial` is true when any repo has no loaded summary or a null count.
- Split View state exists only in the renderer (`SplitState`, see Phase 8). The main process never needs it.

## IPC contract (src/shared/api.ts)

The renderer only ever sends **keys and ids**, never URLs or arbitrary paths. The main process looks up the repo from its own cache.

```ts
interface Api {
  secureStorageAvailable(): Promise<boolean>
  accounts: { list(); test(input); add(input); remove(id) }
  repos: { cached(accountId); fetch(accountId) } // stale-while-revalidate pair
  summary: { cached(repoKey); fetch(repoKey) }
  local: {
    links(): Promise<Record<repoKey, path>>
    link(repoKey): Promise<string | null> // folder picker, null if cancelled
    unlink(repoKey)
    clone(repoKey, protocol: 'https' | 'ssh'): Promise<string | null>
    info(path)
    graph(path, skip, limit)
    commit(path, hash)
    fetch(path)
    reveal(path)
    onCloneProgress(cb): () => void
  }
  openExternal(url): Promise<void> // http/https only
  projects: {
    list(): Promise<Project[]>
    create(input: {
      name: string
      icon?: string
      color?: string
      repoKeys?: string[]
    }): Promise<Project>
    update(id: string, patch: { name?: string; icon?: string; color?: string }): Promise<Project>
    remove(id: string): Promise<void>
    addRepos(id: string, repoKeys: string[]): Promise<Project>
    removeRepos(id: string, repoKeys: string[]): Promise<Project>
  }
}
```

Any `path` argument must equal one of the stored link values, otherwise throw. Validate commit hashes with `/^[0-9a-f]{7,64}$/i`. Project calls validate that each repo key has the form `accountId:remoteId` and that the account exists.

---

## Phase 1 — Scaffold

- [ ] package.json, tsconfigs, `electron.vite.config.ts`, `.gitignore` (node_modules, out, dist), minimal main/preload/renderer that opens a window showing "GitDeck".
- Window security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `setWindowOpenHandler` that denies and opens http(s) links externally, `will-navigate` blocked for foreign URLs, single-instance lock.

**Verify:** `pnpm typecheck` passes and `pnpm exec electron-vite build` produces `out/main`, `out/preload`, `out/renderer`.

## Phase 2 — Core services (no UI yet)

- [ ] `http.ts`
  - `configureFetch(impl)`. Default is global `fetch`; `main/index.ts` swaps in `net.fetch` so the OS certificate store is used.
  - `getJson` with a 30 s timeout, `HttpError(status, message)`, tolerant of empty bodies and 204.
  - `parseLink(header)` returning `{ next, last }`.
  - `paginate(url, headers)` following `rel="next"`, capped at 100 pages.
  - `countItems(url, headers)`: request with `per_page=1`. Use `x-total` if present, else the `page` param of `rel="last"`, else array length. If `next` exists but neither total nor last does, return `null`.
- [ ] `tls.ts`: set of insecure hostnames, `setCertificateVerifyProc` returning 0 for allowlisted hosts and -3 (default verification) otherwise, and a helper to allow a host temporarily while testing an unsaved account.
- [ ] `store.ts`
  - `config.json` holds accounts, encrypted tokens, repo-to-folder links and projects. `cache.json` holds repo lists and summaries.
  - Tokens are encrypted with `safeStorage` and stored as base64. If encryption is unavailable, refuse to store the token and show a clear error.
  - Atomic writes (write temp file, rename). Removing an account also removes its tokens, cache and links, and removes its repos from every project. Do not auto-remove repos from a project just because a refresh no longer lists them (access may be temporary); the UI shows those as unavailable instead.
- [ ] `gitAuth.ts`: build env for git using `GIT_CONFIG_COUNT/KEY_0/VALUE_0` with key `http.<origin>/.extraHeader` and value `Authorization: Basic base64(user:token)`. User is `x-access-token` for GitHub and `oauth2` for GitLab. Add `GIT_SSL_NO_VERIFY=true` only when the account allows insecure TLS. This scopes the token to one host and keeps it out of argv and `.git/config`.
- [ ] `git.ts` (CLI via `execFile`, never a shell; env `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`)
  - `repoRoot(dir)` via `rev-parse --show-toplevel`
  - `getGraph(cwd, skip, limit)`: `git log --branches --remotes --tags --topo-order --decorate=full --format=<fields joined by %x1f + %x1e> --skip N -n M`. Parse decorations from full ref names (`refs/heads/`, `refs/remotes/`, `tag: refs/tags/`, `HEAD -> ...`), drop `*/HEAD` and stash. Return `[]` for an empty repo. Verify that `%D` really honours `--decorate=full` with the installed git, and adapt if not.
  - `getLocalInfo(cwd)` using `symbolic-ref`, `rev-parse`, `remote -v`, `for-each-ref`, `tag --sort=-creatordate`, `rev-list --count HEAD`, `status --porcelain`, `rev-list --left-right --count @{upstream}...HEAD`, `count-objects -v`. Individual failures yield null, not a thrown error. Strip credentials from remote URLs.
  - `getCommitDetail(cwd, hash)`: `show -s --format=%B` plus `-c core.quotepath=false show -m --first-parent --numstat --format=`.
  - `gitFetch(cwd, env)` with `fetch --all --prune`.
  - `cloneRepo(url, dest, env, onLine)` via `spawn` with `--progress`, splitting stderr on `\r` and `\n`.
- [ ] `shared/graph-layout.ts`: see **Graph algorithm** below.
- [ ] `shared/projects.ts` (pure, no electron): `createProject`, `updateProject` (name trimmed, 1-60 chars, unique case-insensitively; icon must be a known icon id or a single emoji; color must be a known palette id; defaults are icon `folder` and the first palette color), `addRepos` / `removeRepos` (de-duplicate, keep order), `pruneAccount(projects, accountId)` and `aggregateProject(repoKeys, summaries)` (see Phase 9 for the rules).

**Verify:** `tests/` using `node:test` + `tsx` (`pnpm test`):

- `git.test.ts`: create temp repos with `git init`, including a repo with branches, a merge commit, tags and an empty repo. Assert graph output, parsed refs, local info, commit detail.
- `graph-layout.test.ts`: lane assignment on those repos. Assert no commit shares a lane with a still-open line, parents always appear after children, and merge commits produce a `bottom` edge to a second lane.
- `http.test.ts`: `parseLink`, `paginate`, `countItems` against a local `http.createServer`.
- `projects.test.ts`: create/update validation (name uniqueness and trimming, icon and color rules, defaults), add/remove de-duplication and order, `pruneAccount`, and `aggregateProject` with null counts, missing summaries and the same contributor appearing in several repos.

## Phase 3 — Providers

- [ ] `GitProvider`: `verify()`, `listRepos()`, `getSummary(repo)`. Each provider is constructed with `(accountId, baseUrl, token)` and returns complete `Repo` objects.
- [ ] **GitHub** (`api.github.com` for github.com, otherwise `<origin>/api/v3` for GitHub Enterprise). Headers: `Authorization: Bearer`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
  - verify: `GET /user`
  - list: `GET /user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`, paginated
  - summary (run with `Promise.allSettled`, a failed piece becomes null/empty, not an error):
    - `GET /repos/{full}` for license, created, pushed, size, topics
    - commits: `countItems(.../commits)`; a 409 means empty repo, so 0
    - contributors: list `?per_page=25`, count via `countItems(.../contributors)`
    - languages: `/languages` (bytes → percent, top 8)
    - branches and tags: `countItems`
    - open PRs: `countItems(.../pulls?state=open)`
- [ ] **GitLab** (`<baseUrl>/api/v4`, header `PRIVATE-TOKEN`). Make relative avatar URLs absolute using the base URL.
  - verify: `GET /user`
  - list: `GET /projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`, paginated
  - summary (same `allSettled` rule):
    - `GET /projects/:id?statistics=true&license=true` for `commit_count`, `repository_size`, license, dates, topics. If statistics are missing (low permission), fall back to `countItems(.../repository/commits)`.
    - contributors: `/repository/contributors?order_by=commits&sort=desc&per_page=100`; use `x-total` if sent, else the array length. Show the top 25.
    - languages: `/languages` (already percentages)
    - branches, tags, open MRs (`/merge_requests?state=opened`): `countItems`
- [ ] `createProvider(account, token)` factory. Normalise the base URL (default per type, add `https://` if missing, http/https only, strip trailing slash).

**Verify:** `tests/providers.test.ts` runs both providers against a local mock server that mimics paginated lists, `Link` and `X-Total` headers, a 409 empty-repo response, and a 403 on contributors. Cover self-hosted base URLs with a path prefix.

## Phase 4 — IPC and main wiring

- [ ] `ipc.ts` implements the full `Api` above.
  - Normalise and validate `AccountInput`. `accounts:add` verifies the token against the host first and rejects duplicates (same type, base URL and username).
  - De-duplicate in-flight requests per account and per repo.
  - Link: folder picker, `repoRoot`, then if no remote URL contains the repo's `fullName` (case-insensitive) show a "Link anyway?" confirmation.
  - Clone: parent-folder picker, destination `<parent>/<sanitised name>`, refuse if it exists and is non-empty, use `httpUrl` or `sshUrl`, attach auth env only for HTTPS, stream progress (line plus percent) over `clone:progress`, guard against concurrent clones of one repo, store the link on success.
  - Local fetch: look up the account from the linked repo and pass the scoped auth env.
  - `openExternal` accepts http/https only.
  - Projects: implement `projects.*` on top of `shared/projects.ts` and persist through the store. Return the updated `Project` from every mutation. Reject empty or duplicate names and unknown repo keys with plain error messages.
  - Concurrency: cap simultaneous git child processes at 4 with a small semaphore in `git.ts`, because two panes (and "Fetch all" in a project) can start work at the same time. Clone progress events must carry the `repoKey` so the right pane updates.
  - Errors thrown to the renderer carry plain, token-free messages.
- [ ] `preload/index.ts` exposes `window.api` with `contextBridge`. Add `src/renderer/src/env.d.ts` declaring `window.api: Api`.
- [ ] `main/index.ts`: configure fetch with `net.fetch`, install the certificate verifier, sync insecure hosts from stored accounts on start and after add/remove, register IPC.

**Verify:** typecheck passes, `electron-vite build` succeeds, and the full test suite is green.

## Phase 5 — Renderer: shell, accounts, sidebar

- [ ] Theme and shell from **UI design** above: import `tokens.css`, theme switch (System / Dark / Light), 48 px toolbar, 40 px icon rail, 300 px sidebar island and a flexible main island. Build the `ui/` components listed there, a small inline SVG icon set (24 px viewBox, 1.8 px stroke, round caps, `currentColor`) and an `Avatar` that falls back to coloured initials (`--avatar-1` to `--avatar-4` with `--avatar-ink`) when the image fails.
- [ ] **Accounts dialog**
  - Presets: GitHub.com, GitLab.com, GitLab self-hosted, GitHub Enterprise.
  - Fields: label, base URL (disabled for the .com presets), token (password input), "allow self-signed certificate" (shown for non-default hosts).
  - "Test connection" and "Create token" (opens the right token page with scopes pre-filled for GitLab).
  - Shows a warning if secure storage is unavailable, and lists existing accounts with remove (with confirm).
- [ ] **Sidebar**
  - Account (host) → namespace (org/group) → repos. The user's own namespace sorts first, the rest alphabetically.
  - Per host: provider badge, label, repo count, spinner while loading, error indicator with the message in a tooltip.
  - Search across name, full name and description. When searching, groups auto-expand.
  - Badges: lock for private, "archived", "fork", dot for linked local clone.
  - Empty state with a "Connect GitHub / GitLab" button.
- [ ] **App state**: load accounts and links, then for each account show cached repos immediately and refresh from the network in the background. Persist the selected repo key in localStorage, but keep selection behind one small `useSelection` hook so Phase 8 can replace it with the split-layout state without touching the sidebar. Clean Electron's `Error invoking remote method '…':` prefix from error messages.

**Verify:** typecheck and build. If a display and a launchable Electron binary exist, run `pnpm dev` and screenshot the accounts dialog and sidebar.

## Phase 6 — Renderer: repo view, overview, info

- [ ] Build this phase as one self-contained `RepoPane` component with props `{ repo, active, onActivate }` that owns its tab state, summary hook and clone/fetch state. Everything below renders inside it.
- [ ] Repo header: name, visibility badge, archived/fork badges, description, "Open on web".
- [ ] Local actions: when not linked show **Clone (HTTPS)**, **Clone (SSH)**, **Link existing folder** with a progress bar during clone. When linked show **Open folder**, **Fetch**, **Unlink**. Fetch bumps a reload token so tabs refresh.
- [ ] Summary hook: show the cached summary immediately, refresh in the background, show a subtle "updated … ago" and a reload button.
- [ ] **Overview**: stat cards (commits, contributors, branches, tags, open PRs or MRs depending on provider, stars, forks, open issues; `—` for null), top-10 contributors with proportional bars and a "show more", a stacked language bar with legend, topic chips.
- [ ] **Info**: remote section (full name, host, visibility, default branch, created, last activity, license, size, web URL, HTTPS and SSH clone URLs with copy buttons) and local section from `LocalInfo` (path, branch or detached HEAD, remotes, branch and tag counts with latest tags, commit count, first and last commit, uncommitted file count, ahead/behind, `.git` size).

## Phase 7 — Commit graph

- [ ] `GitGraph` component with a toolbar (Reload, Fetch, "N commits loaded"). It must be pane-safe: its `GraphLayout` instance, paging state, scroll position and selected commit are per component instance.
- [ ] Load pages of 500 via `local.graph(path, skip, 500)` and keep one stateful `GraphLayout` instance. Use a generation counter so a path change or reload cannot apply stale results. Load the next page when scrolled within about 20 rows of the end, and also when the content is shorter than the viewport.
- [ ] Virtualised list: fixed row height 28 px, render only visible rows plus 10 overscan above and below, spacer element for total height, `ResizeObserver` for the viewport height.
- [ ] Each row is a small SVG (graph lanes) followed by ref badges + subject, author with initials avatar, relative date (full date in tooltip) and short hash. Lane width 16 px, node radius 5, 2 px lines, colours `--lane-1` to `--lane-6` repeating. HEAD gets a ring in `--lane-1` filled with `--island`. Row geometry matches `docs/design-system/components/GraphRow/preview.html`.
- [ ] Row SVG: draw `through` edges as vertical lines, `top` and `bottom` edges as S-curves (cubic Bézier with control points at the vertical midpoint), nodes last.
- [ ] Ref badges: local branch, remote branch and tag styled differently, current branch emphasised, show up to 3 then "+n". Use the `RefBadge` kinds from the design system (HEAD, branch, feature, project, tag with the tag icon).
- [ ] Selecting a row opens a detail panel (`local.commit`): full hash with copy, author and email, date, refs, message body, changed files with +/- counts (binary shown as "binary").
- [ ] Empty states: not linked ("Use Clone or Link above"), empty repository, git error with message.

## Phase 8 — Split View (two repos at once)

Goal: the user can show two different repos side by side (or stacked), each fully working: overview, graph, info, clone, fetch.

- [ ] `renderer/src/lib/splitState.ts`: a pure reducer, no React, so it can be unit tested.
  ```ts
  type PaneId = 0 | 1
  interface PaneState {
    repoKey: string | null
    tab: 'overview' | 'graph' | 'info'
  }
  interface SplitState {
    enabled: boolean
    orientation: 'horizontal' | 'vertical' // horizontal = side by side
    ratio: number // size of pane 0, clamped to 0.25-0.75
    panes: [PaneState, PaneState]
    active: PaneId
  }
  ```
  Actions: `select(repoKey)` loads the repo into the active pane; if it is already shown in the other pane, focus that pane instead (no duplicates). `openInSplit(repoKey)` enables split, puts the repo in the pane that is not active, and makes it active. `setActive`, `setTab(pane, tab)`, `close(pane)` (disables split and keeps the other pane's repo), `swap`, `setOrientation`, `setRatio` (clamped), `pruneRepos(validKeys)` (empties a pane whose repo no longer exists), `toggle`.
  Persist to localStorage under `gitdeck.split.v1`. Validate the shape on load and fall back to the default state on corrupt data.
- [ ] `SplitView` component: CSS grid with a draggable divider (pointer events, `role="separator"`, `aria-valuenow`, arrow keys resize in 2 % steps, double-click resets to 50 %). Minimum pane size 360 px (side by side) or 240 px (stacked). Each pane is a `RepoPane`. The active pane has an accent outline; clicking inside a pane activates it. Sidebar selection loads into the active pane.
- [ ] **Resizing.** The user can adjust the size of each repo view in several ways:
  - drag the divider between the panes (the ratio persists across restarts)
  - arrow keys on the focused divider, and double-click to reset to 50 %
  - resizing or maximising the app window reflows the panes smoothly; the ratio is kept and the minimum pane sizes still apply
  - if the window gets too narrow for two side-by-side panes (under 2 x 360 px plus the divider), fall back to stacked automatically without changing the saved orientation, and restore side by side when there is room again
  - optionally, a collapse/expand control on each pane that minimises it to a thin bar (a clamped ratio of 0.25 is the smallest normal size)
- [ ] Empty pane: placeholder "Pick a repository from the sidebar" and it becomes the active pane.
- [ ] Controls: a "Split view" toggle, an orientation toggle, and a swap button in the main toolbar; a close button on each pane. In the sidebar, each repo row gets a hover action "Open in split view", and repos currently shown get a small `1` / `2` marker.
- [ ] Narrow panes: `RepoPane` measures its own width with a `ResizeObserver` hook. Under 640 px: stat cards use 2 columns, the graph hides the author and date columns, the commit detail opens as an overlay drawer instead of a side column, and header buttons become icon-only.
- [ ] Main window: set `minWidth: 1100` and `minHeight: 700` so two panes stay usable.
- [ ] Shortcuts: `Ctrl/Cmd+Alt+S` toggles split view, `Ctrl/Cmd+1` and `Ctrl/Cmd+2` focus pane 1 or 2.

**Verify:**

- `tests/split-state.test.ts` (reducer): no duplicate repos, `openInSplit`, `close` and `swap`, `pruneRepos`, ratio clamping, persisted JSON round trip, and corrupt JSON falling back to the default.
- `pnpm typecheck` and `pnpm build` pass.
- If a display is available, open two repos with graphs, scroll them independently, drag the divider, switch orientation, and take screenshots. Otherwise say clearly that this was not run visually.

## Phase 9 — Projects

A **Project is a named group of repos from any connected host or account, with a custom name and icon** (similar to GitKraken Workspaces). Keep the data model small.

- [ ] Data: `Project` in `config.json` (types above), including the user's custom `name`, `icon` and `color`. Names are trimmed, 1-60 chars and unique ignoring case. IDs are random UUIDs. A repo can belong to several projects.
- [ ] `ProjectIcon` component renders a project's icon in a colored rounded square: a built-in SVG icon, or the emoji as text. It is used in the scope switcher, the project overview header, "Add to project" menus and the manage dialog. Fall back to the `folder` icon for unknown ids.
- [ ] Scope switcher at the top of the sidebar: "All repositories", then each project with its icon, color and repo count, then "New project..." and "Manage projects...". The choice persists in localStorage (`gitdeck.scope`).
- [ ] In a project scope the sidebar shows only that project's repos, still grouped host, then namespace, with search working inside the project. Repo keys that are not in any loaded repo list (account removed, access lost, not loaded yet) show in an "Unavailable" group with a remove button.
- [ ] Adding repos:
  - a repo row context menu "Add to project..." with a checkbox list of projects plus "New project..."
  - the project dialog has a searchable multi-select of all repos, grouped by host
  - "Remove from project" in the context menu while in project scope
- [ ] **Manage projects dialog**: create, edit, delete (with confirmation). Deleting a project never touches repos or local clones. The create/edit form has:
  - a name field with live validation (empty, too long, duplicate)
  - an **icon picker**: a searchable grid of the built-in icons plus a free text field that accepts one emoji
  - a **color picker** with the 8 palette colors
  - a live preview of the icon and name as they will appear in the sidebar
- [ ] **Project overview page**, shown in the main area when a project scope is active and no repo is selected, and from a "Project overview" button in the sidebar:
  - header with the project icon, name and repo count, and an "Edit project" button
  - stat cards: repos, total commits, contributors, open PRs/MRs, last activity
  - a `partial` badge with a tooltip when some repos have no loaded summary or a null count; totals then count only what is known
  - a sortable table: name, host badge, visibility, commits, contributors, open PRs/MRs, last activity, local status (linked or not)
  - row click opens the repo in the active pane; a row button "Open in split view" opens it in the other pane (Phase 8)
  - cached summaries show immediately; missing or stale ones (older than 1 hour) load in the background with concurrency 3 and a "12/30 loaded" indicator; "Refresh all" forces a reload
- [ ] **Fetch all linked**: runs the local fetch for every linked repo in the project, concurrency 2, and shows a per-repo list with success or failure. Cloning all repos is out of scope.
- [ ] Aggregation rules (`aggregateProject`):
  - commits and open PRs/MRs are sums over known (non-null) values
  - contributors are the union of each repo's top contributors (at most 25 per repo), de-duplicated by lowercase email, else login, and displayed as approximate with a "~" or tooltip
  - last activity is the maximum across repos

**Verify:**

- `tests/projects.test.ts` from Phase 2 passes against the pure helpers.
- Typecheck and build pass.
- If a display is available, create a project with repos from two hosts, open its overview, then open two of its repos in Split View, and screenshot it. Otherwise say clearly that this was not run visually.

## Phase 10 — Polish and docs

- [ ] Loading skeletons and error banners with a retry button everywhere data is fetched.
- [ ] Keyboard: `Ctrl/Cmd+K` focuses search, arrow keys move through the graph rows, plus the Split View shortcuts from Phase 8. List all shortcuts in the README.
- [ ] `README.md`: what it is, features (host integrations, graph, Projects, Split View), requirements (Node >= 22.12, git on PATH), `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`, token scopes (GitHub classic `repo` or fine-grained read access to metadata and contents; GitLab `read_api` + `read_repository`), self-hosted notes (internal CAs work through the OS store, the self-signed toggle is per host), architecture overview, security model (token encryption, scoped git auth, validated IPC), known limits and roadmap, how to package later with electron-builder.
- [ ] Final pass: `pnpm typecheck`, `pnpm test`, `pnpm build` all green.

---

## Graph algorithm (src/shared/graph-layout.ts)

Stateful class so pages can be appended. Keep:

- `lanes: (string | null)[]` where each entry is the hash that lane is waiting for
- `laneColor: number[]`
- a colour counter modulo the palette size

For each commit, in topo order:

1. `incoming` = every lane index whose entry equals this commit's hash.
2. If `incoming` is non-empty: `lane = incoming[0]`, colour is that lane's colour. Otherwise allocate the first free lane (new branch tip) and take a new colour.
3. Emit edges from the lane state **before** mutating it: for every non-null lane, `top` (from that lane to this commit's lane) if it is in `incoming`, otherwise `through`.
4. Set every `incoming` lane to null.
5. Parents: the first parent goes into `lane` and emits a `bottom` edge straight down. Each further parent reuses a lane that already waits for it, otherwise gets a freshly allocated lane and colour. Emit a `bottom` edge from `lane` to that lane using that lane's colour. A commit with no parents leaves its lane free.
6. Pop trailing null lanes. Track `width` (highest lane index used plus 1) per row and `maxLanes` overall.

Row shape: `{ commit, lane, color, edges: { part: 'top'|'bottom'|'through', from, to, color }[], width }`.

## Definition of done

- `pnpm typecheck`, `pnpm test` and `pnpm build` all pass from a clean clone.
- Provider logic is covered by mock-server tests, and the graph and git service by temp-repo tests.
- No token ever appears in logs, error messages, `.git/config` or process arguments.
- Split View shows two different repos at once with independent graphs, tabs and scrolling; Projects survive an app restart; removing an account removes its repos from every project.
- README is accurate, and the final report to the user lists what was verified and what was not (in particular any visual run of the Electron window).

## Non-goals for this version

Staging and committing, diff viewer, merge-conflict UI, rebase and cherry-pick, PR/MR creation, OAuth login (tokens only), SQLite cache, auto-update and installers, more than two split panes, drag-and-drop between projects, cloning all repos of a project at once.
