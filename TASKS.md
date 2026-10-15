# GitDeck tasks

Task list derived from [PLAN.md](PLAN.md). Tick a box when the task is done and its phase **Verify** step passes.

## Phase 1 — Scaffold

- [x] Scaffold: package.json, tsconfigs, `electron.vite.config.ts`, minimal main/preload/renderer window
- [x] Window security: contextIsolation, sandbox, window-open handler, will-navigate block, single-instance lock

**Verify:** `npm run typecheck`; `electron-vite build` produces `out/main`, `out/preload`, `out/renderer`.

## Phase 2 — Core services

- [x] `http.ts`: configureFetch, getJson, HttpError, parseLink, paginate, countItems
- [x] `tls.ts`: insecure host allowlist + certificate verify proc
- [x] `store.ts`: config.json/cache.json, safeStorage token encryption, atomic writes
- [x] `gitAuth.ts`: scoped GIT_CONFIG extraHeader env per host
- [x] `git.ts`: repoRoot, getGraph, getLocalInfo, getCommitDetail, gitFetch, cloneRepo
- [x] `shared/graph-layout.ts`: stateful lane assignment algorithm
- [x] Tests: `git.test.ts`, `graph-layout.test.ts`, `http.test.ts` (node:test via tsx)

## Phase 3 — Providers

- [x] `GitProvider` interface + `createProvider` factory with base URL normalisation
- [x] GitHub provider: verify, listRepos, getSummary (allSettled)
- [x] GitLab provider: verify, listRepos, getSummary (allSettled, stats fallback)
- [x] `providers.test.ts` against local mock server (pagination, 409, 403, path-prefix base URL)

## Phase 4 — IPC and main wiring

- [x] Shared domain types and IPC contract (`shared/types.ts`, `shared/api.ts`)
- [x] `ipc.ts`: account and repo handlers, link, clone, fetch, openExternal
- [x] Preload bridge, `env.d.ts`, `main/index.ts` wiring (net.fetch, cert verifier, insecure host sync)

**Verify:** typecheck, `electron-vite build`, full test suite green.

## Phase 5 — Renderer: shell, accounts, sidebar

- [x] UI foundation: dark theme, two-column layout, icon set, Avatar
- [x] Accounts dialog: presets, token workflow, test connection, secure-storage warning
- [x] Sidebar: host → namespace → repos, search, badges, empty state
- [x] App state: stale-while-revalidate, persisted selection, error prefix cleanup

## Phase 6 — Repo view, overview, info

- [x] Repo header and local actions (clone, link, open, fetch, unlink)
- [x] Summary hook and Overview tab
- [x] Info tab (remote + local)

## Phase 7 — Commit graph

- [x] `GitGraph`: toolbar, paginated loading, virtualised list
- [x] Graph row rendering: SVG lanes, ref badges, metadata columns
- [x] Commit detail panel and empty/error states

## Phase 8 — Polish and docs

- [x] Loading skeletons and error banners with retry
- [x] Keyboard: Ctrl/Cmd+K search focus, arrow keys in graph
- [x] `README.md`
- [x] Final pass: `npm run typecheck`, `npm test`, `npm run build` all green
