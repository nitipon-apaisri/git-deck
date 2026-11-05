# Decisions

Newest first. Template:

## YYYY-MM-DD: Title

- **Question:**
- **Options considered:**
- **Decision and why:**

## 2026-11-05: Phase 6 choices not fixed by PLAN.md

- **Question:** What `RepoPane` takes beyond `{ repo, active, onActivate }`, how null figures read, what a clone in progress does when the user switches repo, and how loading is kept from painting a stale answer.
- **Options considered:** `RepoPane` reading links and accounts itself; `—` or "Unavailable" for null; a clone state held above the pane; a generation counter in each hook.
- **Decision and why:**
  - `RepoPane` also takes `account`, `linkedPath` and `onLinksChanged`. The workspace owns the links because the sidebar dot needs them, so after a clone, link or unlink the pane asks the workspace to re-read `local.links()` (the source of truth in main) instead of guessing the new path. `className` is passed through for the Split View grid.
  - Null figures: `—` while a load is running and nothing is cached, "Unavailable" once it has finished with no value. PLAN.md says `—`, the design system says "Unavailable" instead of 0; this keeps both and never shows 0 for an unknown. Stars, forks and open issues come from the repo list and are never null.
  - The summary and local info are loaded through one pure keyed reducer (`lib/resource.ts`). A result for a key the pane has left is dropped, a reload keeps the old data on screen, and a failed refresh keeps it and shows the message. Each effect run also has a `cancelled` flag.
  - Local info is read only while the Info tab is open. Fetch, clone and link bump a per-pane `reloadToken` that `useLocalInfo` depends on. A fetch does not reload the summary: it comes from the host, not from git.
  - `MainPane` keys `RepoPane` by repo key, so switching repository starts with clean pane state. Cost: if the user switches away during a clone, the progress bar is lost. Main keeps cloning and the sidebar dot appears when it finishes, and starting the same clone again is refused with "already being cloned". Phase 8 panes stay mounted, so this only affects single view.
  - Unlink does not ask for confirmation: it only forgets the folder and the tooltip says nothing is deleted.
  - Contributor bars are relative to the top contributor, so the first bar is always full. Languages use `--proj-*` colours (8 tokens for the 8 languages the provider returns); the legend always names each one.
  - `--radius-round` is `50%`, which turns a wide bar into a lens. Bars use `--radius-xs` and chips `--radius-lg`. Found in the real window.
  - Mono text (hashes, paths, URLs) has ligatures off, because JetBrains Mono draws `://` with a gap.
  - The Graph tab is not stubbed. Phase 7 adds an entry to the `TABS` array.
- **Not verified:** Clone and "Link existing folder" open a native folder picker that cannot be driven over CDP, so only their unlinked UI and the pure logic are covered. "Open folder" (`shell.showItemInFolder`) was not clicked. Clone progress rendering was not seen live. The summary error banner needs `summary.fetch` itself to throw, which a provider with failing endpoints never does (failed pieces become null), so it was not seen live either.

## 2026-11-05: Phase 5 choices not fixed by PLAN.md

- **Question:** How to build `ui/` components under the CSP, where the dialog and theme logic live so tests can reach them, which glyphs `ProjectIcon` draws, and what the shell shows before Phase 6.
- **Options considered:** a hand-made modal with a focus trap; inline theme script in `index.html`; drawing all 30 project glyphs now; a separate tree level for namespaces.
- **Decision and why:**
  - Styling is CSS Modules with tokens only (checked: no hex or `rgb()` outside `tokens.css`). `tokens.css` is a copy of `docs/design-system/tokens.css` that Prettier reformatted.
  - `Dialog` uses the native modal `<dialog>`: focus trap, Escape, top layer and backdrop come free. It opens on mount. Focus returns to the opener in a layout-effect cleanup, because React removes the element before passive cleanups and a detached dialog cannot give focus back (found in the real window, fixed).
  - The theme is applied by `initTheme()` at the top of `main.tsx`. The CSP forbids an inline script, and a module that runs before `createRoot` was enough in the real window (no flash seen with the System setting on a light OS).
  - Fonts: Inter 400/500/600 and JetBrains Mono 400/500, Latin subset only. Non-Latin names fall back to the system font. Each weight ships as `woff2` and `woff`; the build keeps both.
  - Pure code (theme, tree, presets, errors, formatters, workspace reducer) lives in `renderer/src/lib/` with relative imports and no DOM types, so it runs under `tsx` and is also type-checked by `tsconfig.node.json`. `normalizeBaseUrl` moved to `shared/` so the dialog and main share it.
  - Sidebar: account, then namespace, then repos. The namespace row is a quiet group label, not a third `TreeRow` level. Repos sort by name, not by recent activity. Search covers name, full name and description, hides hosts with no match, and expands every group. Collapsed groups and the sidebar's open state persist in localStorage. The list is not virtualised.
  - `ProjectIcon` draws the glyph ids that exist in the icon set and falls back to `folder` for the other `PROJECT_ICONS` ids. Phase 9 draws the rest.
  - "Create token" opens GitHub `settings/tokens/new?scopes=repo,read:org` or GitLab `-/user_settings/personal_access_tokens?scopes=read_api,read_repository`. GitLab older than 16 uses another path and will not pre-fill.
  - The main island shows only the repository header (name, visibility, default branch, cloned state, description). Phase 6 replaces it.
  - Network and HTTP errors are mapped to plain sentences in the renderer (`lib/errors.ts`), with the code kept for network failures.
  - Known gap: Electron 45 logs that `safeStorage.isEncryptionAvailable` is deprecated in favour of `isAsyncEncryptionAvailable`. `TokenCrypto.isAvailable` is synchronous, so the move needs an interface change. Not done in this phase.

## 2026-11-05: Phase 4 choices not fixed by PLAN.md

- **Question:** Where the IPC logic lives so it stays testable, how errors cross IPC, which senders are trusted, what "unavailable" secure storage means on Linux, and how clone URLs are vetted.
- **Options considered:** put everything in `ipc.ts` (needs `electron`, so no `tsx` tests); let Electron's rejected-invoke errors reach the renderer; trust any frame; accept any clone URL from the API.
- **Decision and why:**
  - `ipc.ts` is only the Electron binding (dialogs, shell, sender check, registration). The logic is in `service.ts` (no `electron`, injected `Ui`, provider and git ops), the channel table in `ipcTable.ts`, shared channel names and the `Api` type in `shared/api.ts`.
  - Handlers return `{ ok, value | error }` and preload rethrows `new Error(message)`. Electron would otherwise prefix messages with "Error invoking remote method". Every service method is wrapped by `guard`, which scrubs stored tokens, the token just typed, and `scheme://user:pass@` credentials, and drops `cause` and stacks.
  - Handlers reject calls whose `senderFrame` is not the app page (dev server origin or `file://`).
  - On Linux the `basic_text` safeStorage backend (no keyring) counts as unavailable, since it is not real encryption.
  - Clone URLs must be http(s) for HTTPS and `ssh://` or `user@host:path` for SSH, so a hostile API response cannot smuggle `ext::` or an option. Auth env is attached only for HTTPS, and git scopes it to the account's origin.
  - Link stores the repo root from `repoRoot`, not the picked subfolder. Path arguments must equal a stored link. The graph page size is capped at 2000.
  - After `listRepos` or `getSummary` returns, the account is re-checked, so removing an account mid-request cannot write its cache back.
  - Project mutations read, change and assign without an `await` in between, so concurrent calls cannot overwrite each other.
  - The git semaphore (limit 4) covers clone as well as short commands, as the plan says. Four long clones can therefore delay fetches.
  - `VerifiedUser` moved to `shared/types.ts` so `shared/api.ts` can use it.

## 2026-11-05: Phase 3 provider choices not fixed by PLAN.md

- **Question:** `verify()` return shape, how to read `x-total` next to the list, relative `Link` URLs, GitLab avatar base, and the contributor fields the APIs do not send.
- **Options considered:** return a full `Account` from `verify`; add a header-returning variant of every helper; resolve avatars against the origin or the base URL.
- **Decision and why:**
  - `verify()` returns `{ username, avatarUrl? }`. Phase 4 builds the `Account` (it owns the id, label and TLS flag).
  - `http.ts` gains `getPage` (items plus `x-total`) for GitLab contributors, and `paginate` now resolves `Link rel="next"` against the current URL, so relative links and path-prefixed installs work.
  - GitLab avatars resolve with `new URL(url, baseUrl + '/')`. A leading-slash path lands on the origin, which is what GitLab emits when it runs under a relative URL root.
  - GitHub contributors use `login` for both `name` and `login`, with an empty `email`. GitLab contributors have `login` and `avatarUrl` empty. The renderer falls back to initials.
  - GitHub `contributorCount` falls back to the list length when the list holds fewer than 25 items and the count call failed.
  - GitHub `lastActivityAt` is `pushed_at`, falling back to `updated_at`. GitHub `sizeKb` is the API `size` (already KB). GitLab `sizeKb` is `repository_size / 1024`, rounded.
  - A license shows its SPDX id (GitHub, unless `NOASSERTION`) or the nickname (GitLab), else the name.

## 2026-11-05: Phase 2 choices not fixed by PLAN.md

- **Question:** Icon ids, `partial` rule and store/electron boundary were unspecified.
- **Options considered:** hard-code `safeStorage` in `store.ts`; derive icon ids from the design system; count only `commitCount` for `partial`.
- **Decision and why:**
  - `store.ts` takes an injected `TokenCrypto` so it runs under `tsx`; `main/index.ts` will pass `safeStorage` in Phase 4.
  - The 8 colour ids come from the design system (`proj-*`). It has no icon list, so `PROJECT_ICONS` holds 30 feather-style ids in `shared/projects.ts`; Phase 9 must draw a glyph for each.
  - `aggregateProject` marks a project `partial` when a summary is missing or any of `commitCount`, `contributorCount` or `openChangeRequests` is null.
  - A single emoji is checked as one grapheme containing an Extended_Pictographic character.
  - `tls.ts` imports `electron` as a type only, so its allowlist logic is testable in plain Node.

## 2026-11-05: Electron 45 and @types/node 22

- **Question:** `PLAN.md` lists electron ^44, but `pnpm view electron version` returns 45.2.3. The engines field allows Node 22.12, the local Node is 26.
- **Options considered:** pin ^44 as listed; use ^45; use `@types/node` 26 to match local Node.
- **Decision and why:** electron ^45 (the plan says to check versions before pinning, and the build passes). `@types/node` ^22 so the code cannot use APIs missing on the minimum supported Node.

## 2026-11-05: pnpm and early tooling package.json

- **Question:** `PLAN.md` and `CLAUDE.md` specified npm, but the sibling project `lens` uses pnpm. Phase 1 (which creates `package.json`) is not done, yet git hooks need one.
- **Options considered:** npm vs pnpm; wait for Phase 1 vs add a tooling-only `package.json` now.
- **Decision and why:** pnpm, to match `lens`. A minimal `package.json` with only devDependencies (husky, lint-staged, prettier, eslint) so hooks work from the first commit. Phase 1 extends it and does not replace it.
