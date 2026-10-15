# GitDeck — build brief for Claude Code

You are building **GitDeck**, a desktop Git client in the spirit of GitKraken. It connects to GitHub, GitLab.com and self-hosted GitLab, lists the user's repos grouped by host, shows a summary per repo, and renders a commit graph from a local clone.

Work through the phases below in order. Do not stop to ask for confirmation between phases. Ask only if something is genuinely ambiguous and cannot be resolved with the defaults in this file.

## How to work

- Build one phase at a time. At the end of each phase run its **Verify** steps, fix failures, then commit with a clear message and tick the phase's checkbox in this file.
- Keep dependencies minimal. Runtime deps are `react`, `react-dom` and the shadcn/ui stack (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`; Tailwind v4 and `tw-animate-css` are dev deps). No other UI kit, no state library, no native modules (no SQLite, no keytar). Persist with JSON files.
- Prefer small, typed, pure modules. Anything that does not need Electron must not import `electron`, so it can be tested in plain Node.
- Treat Electron GUI launch as unavailable if there is no display. Verify with typecheck, build and tests, and say clearly at the end what was not run visually.
- Never write secrets (tokens) to logs, error messages, or git config files.

## Stack and versions

Check each version with `npm view <pkg> version` before pinning. Known good at planning time:

| Package | Version |
|---|---|
| electron | ^44 |
| electron-vite | ^6 (rolldown based, needs Node >= 22.12) |
| vite | ^8 |
| @vitejs/plugin-react | ^6 |
| react / react-dom | ^19 |
| typescript | ~5.9 (do not use 7.x yet) |
| tsx | ^4 (tests only) |

Install with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` in headless or sandboxed environments.

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
  renderer/
    index.html
    src/                main.tsx, App.tsx, styles.css, components/, lib/
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

## IPC contract (src/shared/api.ts)

The renderer only ever sends **keys and ids**, never URLs or arbitrary paths. The main process looks up the repo from its own cache.

```ts
interface Api {
  secureStorageAvailable(): Promise<boolean>
  accounts: { list(); test(input); add(input); remove(id) }
  repos:    { cached(accountId); fetch(accountId) }          // stale-while-revalidate pair
  summary:  { cached(repoKey); fetch(repoKey) }
  local: {
    links(): Promise<Record<repoKey, path>>
    link(repoKey): Promise<string | null>                    // folder picker, null if cancelled
    unlink(repoKey)
    clone(repoKey, protocol: 'https' | 'ssh'): Promise<string | null>
    info(path); graph(path, skip, limit); commit(path, hash); fetch(path)
    reveal(path)
    onCloneProgress(cb): () => void
  }
  openExternal(url): Promise<void>                           // http/https only
}
```

Any `path` argument must equal one of the stored link values, otherwise throw. Validate commit hashes with `/^[0-9a-f]{7,64}$/i`.

---

## Phase 1 — Scaffold

- [x] package.json, tsconfigs, `electron.vite.config.ts`, `.gitignore` (node_modules, out, dist), minimal main/preload/renderer that opens a window showing "GitDeck".
- Window security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `setWindowOpenHandler` that denies and opens http(s) links externally, `will-navigate` blocked for foreign URLs, single-instance lock.

**Verify:** `npm run typecheck` passes and `npx electron-vite build` produces `out/main`, `out/preload`, `out/renderer`.

## Phase 2 — Core services (no UI yet)

- [x] `http.ts`
  - `configureFetch(impl)`. Default is global `fetch`; `main/index.ts` swaps in `net.fetch` so the OS certificate store is used.
  - `getJson` with a 30 s timeout, `HttpError(status, message)`, tolerant of empty bodies and 204.
  - `parseLink(header)` returning `{ next, last }`.
  - `paginate(url, headers)` following `rel="next"`, capped at 100 pages.
  - `countItems(url, headers)`: request with `per_page=1`. Use `x-total` if present, else the `page` param of `rel="last"`, else array length. If `next` exists but neither total nor last does, return `null`.
- [x] `tls.ts`: set of insecure hostnames, `setCertificateVerifyProc` returning 0 for allowlisted hosts and -3 (default verification) otherwise, and a helper to allow a host temporarily while testing an unsaved account.
- [x] `store.ts`
  - `config.json` holds accounts, encrypted tokens and repo-to-folder links. `cache.json` holds repo lists and summaries.
  - Tokens are encrypted with `safeStorage` and stored as base64. If encryption is unavailable, refuse to store the token and show a clear error.
  - Atomic writes (write temp file, rename). Removing an account also removes its tokens, cache and links.
- [x] `gitAuth.ts`: build env for git using `GIT_CONFIG_COUNT/KEY_0/VALUE_0` with key `http.<origin>/.extraHeader` and value `Authorization: Basic base64(user:token)`. User is `x-access-token` for GitHub and `oauth2` for GitLab. Add `GIT_SSL_NO_VERIFY=true` only when the account allows insecure TLS. This scopes the token to one host and keeps it out of argv and `.git/config`.
- [x] `git.ts` (CLI via `execFile`, never a shell; env `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`)
  - `repoRoot(dir)` via `rev-parse --show-toplevel`
  - `getGraph(cwd, skip, limit)`: `git log --branches --remotes --tags --topo-order --decorate=full --format=<fields joined by %x1f + %x1e> --skip N -n M`. Parse decorations from full ref names (`refs/heads/`, `refs/remotes/`, `tag: refs/tags/`, `HEAD -> ...`), drop `*/HEAD` and stash. Return `[]` for an empty repo. Verify that `%D` really honours `--decorate=full` with the installed git, and adapt if not.
  - `getLocalInfo(cwd)` using `symbolic-ref`, `rev-parse`, `remote -v`, `for-each-ref`, `tag --sort=-creatordate`, `rev-list --count HEAD`, `status --porcelain`, `rev-list --left-right --count @{upstream}...HEAD`, `count-objects -v`. Individual failures yield null, not a thrown error. Strip credentials from remote URLs.
  - `getCommitDetail(cwd, hash)`: `show -s --format=%B` plus `-c core.quotepath=false show -m --first-parent --numstat --format=`.
  - `gitFetch(cwd, env)` with `fetch --all --prune`.
  - `cloneRepo(url, dest, env, onLine)` via `spawn` with `--progress`, splitting stderr on `\r` and `\n`.
- [x] `shared/graph-layout.ts`: see **Graph algorithm** below.

**Verify:** `tests/` using `node:test` + `tsx` (`npm test`):
- `git.test.ts`: create temp repos with `git init`, including a repo with branches, a merge commit, tags and an empty repo. Assert graph output, parsed refs, local info, commit detail.
- `graph-layout.test.ts`: lane assignment on those repos. Assert no commit shares a lane with a still-open line, parents always appear after children, and merge commits produce a `bottom` edge to a second lane.
- `http.test.ts`: `parseLink`, `paginate`, `countItems` against a local `http.createServer`.

## Phase 3 — Providers

- [x] `GitProvider`: `verify()`, `listRepos()`, `getSummary(repo)`. Each provider is constructed with `(accountId, baseUrl, token)` and returns complete `Repo` objects.
- [x] **GitHub** (`api.github.com` for github.com, otherwise `<origin>/api/v3` for GitHub Enterprise). Headers: `Authorization: Bearer`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
  - verify: `GET /user`
  - list: `GET /user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`, paginated
  - summary (run with `Promise.allSettled`, a failed piece becomes null/empty, not an error):
    - `GET /repos/{full}` for license, created, pushed, size, topics
    - commits: `countItems(.../commits)`; a 409 means empty repo, so 0
    - contributors: list `?per_page=25`, count via `countItems(.../contributors)`
    - languages: `/languages` (bytes → percent, top 8)
    - branches and tags: `countItems`
    - open PRs: `countItems(.../pulls?state=open)`
- [x] **GitLab** (`<baseUrl>/api/v4`, header `PRIVATE-TOKEN`). Make relative avatar URLs absolute using the base URL.
  - verify: `GET /user`
  - list: `GET /projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`, paginated
  - summary (same `allSettled` rule):
    - `GET /projects/:id?statistics=true&license=true` for `commit_count`, `repository_size`, license, dates, topics. If statistics are missing (low permission), fall back to `countItems(.../repository/commits)`.
    - contributors: `/repository/contributors?order_by=commits&sort=desc&per_page=100`; use `x-total` if sent, else the array length. Show the top 25.
    - languages: `/languages` (already percentages)
    - branches, tags, open MRs (`/merge_requests?state=opened`): `countItems`
- [x] `createProvider(account, token)` factory. Normalise the base URL (default per type, add `https://` if missing, http/https only, strip trailing slash).

**Verify:** `tests/providers.test.ts` runs both providers against a local mock server that mimics paginated lists, `Link` and `X-Total` headers, a 409 empty-repo response, and a 403 on contributors. Cover self-hosted base URLs with a path prefix.

## Phase 4 — IPC and main wiring

- [x] `ipc.ts` implements the full `Api` above.
  - Normalise and validate `AccountInput`. `accounts:add` verifies the token against the host first and rejects duplicates (same type, base URL and username).
  - De-duplicate in-flight requests per account and per repo.
  - Link: folder picker, `repoRoot`, then if no remote URL contains the repo's `fullName` (case-insensitive) show a "Link anyway?" confirmation.
  - Clone: parent-folder picker, destination `<parent>/<sanitised name>`, refuse if it exists and is non-empty, use `httpUrl` or `sshUrl`, attach auth env only for HTTPS, stream progress (line plus percent) over `clone:progress`, guard against concurrent clones of one repo, store the link on success.
  - Local fetch: look up the account from the linked repo and pass the scoped auth env.
  - `openExternal` accepts http/https only.
  - Errors thrown to the renderer carry plain, token-free messages.
- [x] `preload/index.ts` exposes `window.api` with `contextBridge`. Add `src/renderer/src/env.d.ts` declaring `window.api: Api`.
- [x] `main/index.ts`: configure fetch with `net.fetch`, install the certificate verifier, sync insecure hosts from stored accounts on start and after add/remove, register IPC.

**Verify:** typecheck passes, `electron-vite build` succeeds, and the full test suite is green.

## Phase 5 — Renderer: shell, accounts, sidebar

- [x] Dark theme using CSS variables. Two-column layout: 320 px sidebar, flexible main pane. Small inline SVG icon set (feather-style paths) and an `Avatar` component that falls back to coloured initials when the image fails.
- [x] **Accounts dialog**
  - Presets: GitHub.com, GitLab.com, GitLab self-hosted, GitHub Enterprise.
  - Fields: label, base URL (disabled for the .com presets), token (password input), "allow self-signed certificate" (shown for non-default hosts).
  - "Test connection" and "Create token" (opens the right token page with scopes pre-filled for GitLab).
  - Shows a warning if secure storage is unavailable, and lists existing accounts with remove (with confirm).
- [x] **Sidebar**
  - Account (host) → namespace (org/group) → repos. The user's own namespace sorts first, the rest alphabetically.
  - Per host: provider badge, label, repo count, spinner while loading, error indicator with the message in a tooltip.
  - Search across name, full name and description. When searching, groups auto-expand.
  - Badges: lock for private, "archived", "fork", dot for linked local clone.
  - Empty state with a "Connect GitHub / GitLab" button.
- [x] **App state**: load accounts and links, then for each account show cached repos immediately and refresh from the network in the background. Persist the selected repo key in localStorage. Clean Electron's `Error invoking remote method '…':` prefix from error messages.

**Verify:** typecheck and build. If a display and a launchable Electron binary exist, run `npm run dev` and screenshot the accounts dialog and sidebar.

## Phase 6 — Renderer: repo view, overview, info

- [x] Repo header: name, visibility badge, archived/fork badges, description, "Open on web".
- [x] Local actions: when not linked show **Clone (HTTPS)**, **Clone (SSH)**, **Link existing folder** with a progress bar during clone. When linked show **Open folder**, **Fetch**, **Unlink**. Fetch bumps a reload token so tabs refresh.
- [x] Summary hook: show the cached summary immediately, refresh in the background, show a subtle "updated … ago" and a reload button.
- [x] **Overview**: stat cards (commits, contributors, branches, tags, open PRs or MRs depending on provider, stars, forks, open issues; `—` for null), top-10 contributors with proportional bars and a "show more", a stacked language bar with legend, topic chips.
- [x] **Info**: remote section (full name, host, visibility, default branch, created, last activity, license, size, web URL, HTTPS and SSH clone URLs with copy buttons) and local section from `LocalInfo` (path, branch or detached HEAD, remotes, branch and tag counts with latest tags, commit count, first and last commit, uncommitted file count, ahead/behind, `.git` size).

## Phase 7 — Commit graph

- [x] `GitGraph` component with a toolbar (Reload, Fetch, "N commits loaded").
- [x] Load pages of 500 via `local.graph(path, skip, 500)` and keep one stateful `GraphLayout` instance. Use a generation counter so a path change or reload cannot apply stale results. Load the next page when scrolled within about 20 rows of the end, and also when the content is shorter than the viewport.
- [x] Virtualised list: fixed row height 28 px, render only visible rows plus 10 overscan above and below, spacer element for total height, `ResizeObserver` for the viewport height.
- [x] Each row is a small SVG (graph lanes) followed by ref badges + subject, author with initials avatar, relative date (full date in tooltip) and short hash. Lane width 16 px, node radius about 4.5, 8-colour palette. HEAD gets a ring.
- [x] Row SVG: draw `through` edges as vertical lines, `top` and `bottom` edges as S-curves (cubic Bézier with control points at the vertical midpoint), nodes last.
- [x] Ref badges: local branch, remote branch and tag styled differently, current branch emphasised, show up to 4 then "+n".
- [x] Selecting a row opens a detail panel (`local.commit`): full hash with copy, author and email, date, refs, message body, changed files with +/- counts (binary shown as "binary").
- [x] Empty states: not linked ("Use Clone or Link above"), empty repository, git error with message.

## Phase 8 — Polish and docs

- [x] Loading skeletons and error banners with a retry button everywhere data is fetched.
- [x] Keyboard: `Ctrl/Cmd+K` focuses search, arrow keys move through the graph rows.
- [x] `README.md`: what it is, requirements (Node >= 22.12, git on PATH), `npm install`, `npm run dev`, `npm run build`, `npm test`, token scopes (GitHub classic `repo` or fine-grained read access to metadata and contents; GitLab `read_api` + `read_repository`), self-hosted notes (internal CAs work through the OS store, the self-signed toggle is per host), architecture overview, security model (token encryption, scoped git auth, validated IPC), known limits and roadmap, how to package later with electron-builder.
- [x] Final pass: `npm run typecheck`, `npm test`, `npm run build` all green.

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

- `npm run typecheck`, `npm test` and `npm run build` all pass from a clean clone.
- Provider logic is covered by mock-server tests, and the graph and git service by temp-repo tests.
- No token ever appears in logs, error messages, `.git/config` or process arguments.
- README is accurate, and the final report to the user lists what was verified and what was not (in particular any visual run of the Electron window).

## Non-goals for this version

Staging and committing, diff viewer, merge-conflict UI, rebase and cherry-pick, PR/MR creation, OAuth login (tokens only), SQLite cache, auto-update and installers.
