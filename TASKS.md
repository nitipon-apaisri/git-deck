# GitDeck tasks

Task list derived from [PLAN.md](PLAN.md). Tick a box when the task is done and its phase **Verify** step passes.

## Phase 1 — Scaffold

- [x] Scaffold: package.json, tsconfigs, `electron.vite.config.ts`, minimal main/preload/renderer window
- [x] Window security: contextIsolation, sandbox, window-open handler, will-navigate block, single-instance lock

**Verify:** `npm run typecheck`; `electron-vite build` produces `out/main`, `out/preload`, `out/renderer`.

## Phase 2 — Core services

- [ ] `http.ts`: configureFetch, getJson, HttpError, parseLink, paginate, countItems
- [ ] `tls.ts`: insecure host allowlist + certificate verify proc
- [ ] `store.ts`: config.json/cache.json, safeStorage token encryption, atomic writes
- [ ] `gitAuth.ts`: scoped GIT_CONFIG extraHeader env per host
- [ ] `git.ts`: repoRoot, getGraph, getLocalInfo, getCommitDetail, gitFetch, cloneRepo
- [ ] `shared/graph-layout.ts`: stateful lane assignment algorithm
- [ ] Tests: `git.test.ts`, `graph-layout.test.ts`, `http.test.ts` (node:test via tsx)

## Phase 3 — Providers

- [ ] `GitProvider` interface + `createProvider` factory with base URL normalisation
- [ ] GitHub provider: verify, listRepos, getSummary (allSettled)
- [ ] GitLab provider: verify, listRepos, getSummary (allSettled, stats fallback)
- [ ] `providers.test.ts` against local mock server (pagination, 409, 403, path-prefix base URL)

## Phase 4 — IPC and main wiring

- [ ] Shared domain types and IPC contract (`shared/types.ts`, `shared/api.ts`)
- [ ] `ipc.ts`: account and repo handlers, link, clone, fetch, openExternal
- [ ] Preload bridge, `env.d.ts`, `main/index.ts` wiring (net.fetch, cert verifier, insecure host sync)

**Verify:** typecheck, `electron-vite build`, full test suite green.

## Phase 5 — Renderer: shell, accounts, sidebar

- [ ] UI foundation: dark theme, two-column layout, icon set, Avatar
- [ ] Accounts dialog: presets, token workflow, test connection, secure-storage warning
- [ ] Sidebar: host → namespace → repos, search, badges, empty state
- [ ] App state: stale-while-revalidate, persisted selection, error prefix cleanup

## Phase 6 — Repo view, overview, info

- [ ] Repo header and local actions (clone, link, open, fetch, unlink)
- [ ] Summary hook and Overview tab
- [ ] Info tab (remote + local)

## Phase 7 — Commit graph

- [ ] `GitGraph`: toolbar, paginated loading, virtualised list
- [ ] Graph row rendering: SVG lanes, ref badges, metadata columns
- [ ] Commit detail panel and empty/error states

## Phase 8 — Polish and docs

- [ ] Loading skeletons and error banners with retry
- [ ] Keyboard: Ctrl/Cmd+K search focus, arrow keys in graph
- [ ] `README.md`
- [ ] Final pass: `npm run typecheck`, `npm test`, `npm run build` all green
