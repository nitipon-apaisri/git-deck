# Decisions

Newest first. Template:

## YYYY-MM-DD: Title

- **Question:**
- **Options considered:**
- **Decision and why:**

## 2026-11-06: Open a local repository

- **Question:** Can a folder be opened without any account?
- **Decision and why:**
  - Yes. Open adds a local-only repository: main resolves the folder's git root, gives it the key `local:<12 hex of sha1(root)>` (so the same folder is one entry) and stores it in `config.json` (`localRepos`) plus the existing `links` table. Because every read-only git call is gated by that table, the graph, Info, Fetch and Reveal work unchanged.
  - A real account id is a UUID, so `local` cannot collide with one. `local.unlink` refuses local keys and `local.remove` refuses everything else.
  - Local repositories show under a "Local" group at the top of the sidebar, have no Overview tab (no host summary), no Open on web and no Unlink, and open on the Graph tab. Remove only forgets the entry.
  - Left out: local repositories in Projects, an Overview built from git alone, matching a folder's remote to an account repository, and drag-and-drop of a folder.
  - Not checked in the window: the native folder picker itself (the service tests use a fake picker), and Windows and Linux paths.

## 2026-11-06: Settings, accents, fonts and motion

- **Question:** Preferences should look like lens, hold Appearance and Integrations, and the main pane should stop asking to connect an account.
- **Decision and why:**
  - One Settings dialog (about 40px inset, section list on the left) replaces the Preferences and Accounts dialogs. The rail's Accounts button, the toolbar chip and the sidebar's Connect button open it on Integrations. Both sections stay mounted, so a half-filled account form survives.
  - "Colour scheme" means theme plus 5 accent presets (blue, violet, green, orange, rose). Each preset overrides five tokens per theme in `appearance.css`. Contrast was checked: primary against white at least 4.5:1, accent text at least 4.5:1, accent and focus ring at least 3:1.
  - Fonts: Inter, Roboto, Open Sans and System, as `@fontsource` dev dependencies. Code stays in JetBrains Mono.
  - The empty main pane says "No repository selected" with no connect button. The sidebar keeps its own button.
  - Motion tokens `motion-fast` 120ms, `motion-base` 180ms, `ease-out`. Dialogs and menus fade in with `@starting-style`. Closing is not animated, because dialogs unmount to close. Reduced motion is honoured by `global.css`.
  - Not done: the sidebar width is not animated, as it would reflow the graph on every frame.

## 2026-11-06: Toolbar in the title bar (macOS)

- **Question:** The toolbar sat below the native title bar. Can it share the row with the window buttons to give the main area more height?
- **Options considered:** `hiddenInset` on macOS only; `hidden` plus `titleBarOverlay` on Windows and Linux too; keep the native frame.
- **Decision and why:**
  - macOS only, with `titleBarStyle: 'hiddenInset'` and the traffic lights at `{x: 16, y: 18}`. The renderer reads the user agent (`lib/platform.ts`), so no IPC is added.
  - Windows and Linux keep the native frame. `titleBarOverlay` colours are hex strings set from main and would have to follow the theme, which breaks the tokens-only rule, and I cannot run those platforms.
  - The toolbar is a drag region and its buttons are `no-drag`. The 80px left space is the `titlebar-inset` token.
  - Known gap: in macOS full screen the traffic lights are hidden but the 80px space stays. Fixing it needs a main-to-renderer event.

## 2026-11-06: Phase 10 choices not fixed by PLAN.md

- **Question:** What "everywhere data is fetched" covers, how a failed summary should behave, which keys count as shortcuts, and what the README may claim.
- **Options considered:** a banner everywhere or only on the main views; leaving the providers returning an empty summary when every request fails; `Mod+K` global or only outside inputs; claiming Windows and Linux support.
- **Decision and why:**
  - One `ErrorBanner` (message plus Retry) and one `Skeleton` are the only loading and error patterns. They are used for the repo summary, the folder info, the commit detail, the first load of accounts, the project list, and failed project summaries (retry only those). The graph already had its own "Try again" and was left alone. Per-account list errors keep their alert button in the host row, which retries.
  - **Bug found and fixed:** when every request for a summary failed (host down, token refused, repo gone), both providers returned an all-null summary. The service cached it over the good one and the pane showed "Unavailable" with no error. `throwIfAllFailed` now rejects, so the saved data stays and the banner offers Retry. A partial failure (a 403 on contributors) still becomes a null, as PLAN.md Phase 3 says. One Phase 3 test asserted the old behaviour for a repo whose every request 404s: it now expects the rejection.
  - The sidebar used to show "No accounts yet" for a moment at start, before the account list had loaded. It now shows a skeleton until the first load finishes, and an error banner with Retry if that load fails (`loadError` was set but never shown).
  - `Mod+K` works from anywhere except while a modal dialog is open, and opens the sidebar if it was closed. `Esc` clears the filter first, then leaves it. Arrow keys, Page and Home/End in the graph were already built in Phase 7.
  - The README states what was and was not run: macOS only, mock hosts only. Packaging is described, not set up, since adding electron-builder was not asked for.
- **Not verified:** the first-load skeleton and the first-load error banner (both finish in milliseconds against a local main process, and there is no way to make the real load fail from the window). The folder-info error banner: `getLocalInfo` tolerates a missing folder, so it could not be provoked. The Retry banners for the summary and for failed project summaries were run against a mock host that was stopped and restarted. Windows and Linux.

## 2026-11-06: Phase 9 choices not fixed by PLAN.md

- **Question:** How the scope, the overview and the menus behave where the plan is silent: what creating a project does to the scope, when a key counts as unavailable, whether the overview replaces or hides the panes, where summaries are held, and what the rail's Projects button does.
- **Options considered:** unavailable as soon as a repo is missing, or only once its account's list has been tried; the overview hiding `MainPane` or unmounting it; summaries held in the overview or in `App`; a floating menu inside the sidebar or in a portal.
- **Decision and why:**
  - Unavailable means "no loaded list has it" **and** the account's list has settled (loaded or failed) or the account is gone. An account whose first list is still loading, and the time before accounts are known, is `pending`: shown in neither list, so a restart does not flash every repo as unavailable. A failed list does leave its repos unavailable, as the plan says ("access lost, not loaded yet"). Pure code: `projectView` in `lib/projectScope.ts`.
  - The overview **replaces** the panes while it shows (`MainPane` takes an `overview` node). It shows when a project scope is active and either no repo is selected (split off) or the user chose it: picking a project, or the sidebar "Project overview" button. Picking a repo or "Open in split view" from a row hides it. The panes unmount, so a graph's scroll position is lost on a trip to the overview. Tab, selection and split state live in `SplitState` and come back. I did not keep the hidden panes mounted: a `display: none` pane has no size, which would break the pane `ResizeObserver` and the scroll restore.
  - Creating a project (from the scope menu, the manage dialog or "New project..." in a repo menu) switches the scope to it and shows its overview. A project that no longer exists resolves to "All repositories".
  - Summaries are held in `App` through `useProjectSummaries`, not inside the overview, so closing and reopening the overview shows them at once. They only load while the overview is on screen: cache read first, then missing or older than one hour, three at a time, and "Refresh summaries" forces all. This is separate from a pane's own summary hook; main de-duplicates in-flight requests per repo.
  - Figures: the sum cards show `–` until at least one summary has loaded (never 0 for unknown). Each sum card has its own Partial badge from its own known count. Contributors is `~n` with a tooltip.
  - Sorting keeps unknown values and unavailable repos last in both directions. The default is last activity, newest first.
  - Repo menu: opens on right-click, and from a "Project options" button that appears on hover or focus in the row, so keyboard users can reach it. Project items are checkboxes and keep the menu open; "Remove from <project>" shows in project scope. The menu renders in a portal and must not be opened from inside a modal dialog (it never is).
  - The rail's layers button opens the Manage projects dialog. The people icon is still Accounts.
  - "Fetch all linked" starts from a click, not an effect, because StrictMode runs effects twice and two `git fetch` runs in one folder can collide. Closing the list stops the queue; fetches already running finish.
  - Icon glyphs for all 30 ids were drawn in the existing style. A compile-time check in `ProjectIcon.tsx` fails the build if an id has no glyph.
  - The form shows an empty-name error only after the field is touched. The emoji field must hold exactly one emoji or be empty, and Save is blocked while it holds anything else.
  - Account removal: main already drops that account's repos from every project, so `App` re-reads the list after a removal.
- **Known limits:** the form's repository list is not virtualised, so thousands of repos render thousands of rows (search narrows it). The sidebar list is not virtualised either. Dead dialog buttons in the sidebar: an Unavailable row's main button does nothing.
- **Not verified:** a real GitHub or GitLab host (two mock hosts, one GitHub Enterprise style and one self-hosted GitLab style, were used). Removing an account that a project uses (covered by `store.test.ts` and the pure helpers, not run in the window). A project with hundreds of repos. Touch input. Windows and Linux.
- **Harness note:** the mock GitLab and GitHub servers and the CDP scripts live in the session scratchpad, not in the repo. Real-window checks ran in light and dark, at 1280 x 768.

## 2026-11-06: Phase 8 choices not fixed by PLAN.md

- **Question:** Where each pane's tab lives, what select and close do to the hidden pane, how panes keep their state across a swap, what "too narrow" measures, and which optional items to skip.
- **Options considered:** tab inside `RepoPane` or in the split state; panes keyed by slot or by repository; a JS or a CSS test for side by side; building the collapse control.
- **Decision and why:**
  - The tab lives in `SplitState` (as the plan's type says), so it survives a restart. `RepoPane` takes `tab` and `onTabChange`. `select` keeps the pane's tab, so a user flicking through repositories on the Graph tab stays there.
  - Panes are keyed by repository, not slot. A swap moves the node instead of rebuilding it, so the loaded graph, selected commit and clone progress survive. Moving a node makes the browser reset its scroll offsets, so `GitGraph` and the `RepoPane` panel put their last scroll position back when their pane number changes (found in the real window).
  - `select` for a repository the other pane already shows focuses that pane, whether or not split is on, so the same repository is never in both panes. `parseSplit` also refuses stored state with a duplicate.
  - Turning split off keeps both repositories (the active one is on screen) and turning it on again brings the second one back. Closing a pane drops that pane and moves the other into the first slot. Only the pane on screen is mounted, so a pane that is hidden by the toggle stops its work.
  - Turning split on makes an empty pane the active one, as the plan says. Each pane, empty or not, has a close button while split is on. `pruneRepos` runs once no list is loading. A pane is kept when its account's list failed or has never loaded, because then the list cannot say the repository is gone. A removed account's panes are emptied.
  - "Too narrow" is measured on the split area, not the window, so a closed sidebar gives the room back. Below 2 x 360 px plus the 12 px divider the panes stack, and the saved orientation is untouched. A window narrower than `minWidth` (the emulated 1000 px in my run) is the only way to get there with the sidebar open, because the window now has `minWidth` 1100.
  - The grid is `minmax(360px, nfr) 12px minmax(360px, mfr)`, so the browser reflows on a resize with no JS in the loop. JS only clamps what is saved while dragging (`fitRatio`). A saved ratio stays as it was and is clamped when drawn, so widening the window restores it.
  - Pane width under 640 px uses a `ResizeObserver` hook on the pane itself (`useElementSize`), not the window. In that mode stat cards use 2 columns, the graph drops author and date, the detail panel is a drawer, and Open on web, Open folder and Fetch show only their icon. Clone, Link and Unlink keep their words, because two download icons would not say HTTPS from SSH.
  - The commit detail drawer moved from a container query to the `narrow` prop, so the pane, not the graph box inside it, decides.
  - Shortcuts match on `code`, not `key`, because Alt+S types "ß" on macOS. Ctrl or Cmd both work, and Ctrl+Alt+Cmd chords are ignored. Ctrl/Cmd+2 with split off does nothing.
  - The old `gitdeck.selection` key is read once, as pane 1, when there is no `gitdeck.split.v1` yet.
  - **Not built:** the optional per-pane collapse control. Divider drag, keys and double-click cover resizing, and 25 % is the smallest ratio.
- **Known limits:** a stacked pane at the 240 px minimum has room for about one graph row, because the header and tabs fill it. A narrower pane than 360 px is not reachable. The two panes' tab order in the DOM follows the slot order.
- **Not verified:** the window `minWidth` and `minHeight` themselves (set in `main/index.ts`, but I resized the page with CDP, not the window). A real second host or account. Removing an account while it is shown (covered by the reducer and `stillValid` tests only). Touch input on the divider. Windows and Linux key chords (the macOS path was run, and Ctrl was sent over CDP).
- **Harness note:** the page stops producing frames when its window is not in front, which paused `ResizeObserver` and made pane sizes look stale. The checks above were run after `Page.bringToFront`.

## 2026-11-06: Phase 7 choices not fixed by PLAN.md

- **Question:** Where the graph lives while another tab shows, how a narrow pane and a failed page behave, the column order, and how the selection survives a reload.
- **Options considered:** unmount the graph on a tab change; keep it mounted; a JS width observer for the drawer; select by row index or by hash.
- **Decision and why:**
  - The Graph tab mounts on the first visit and then stays mounted (hidden). Its scroll position, loaded pages and selected commit survive a trip to Overview or Info, and no second `git log` runs. The last scroll position is saved while visible and restored on return, because a hidden box reports no usable size.
  - Paging is a pure reducer (`lib/graphPaging.ts`). Every action carries its generation, and one from an older generation is dropped. The `GraphLayout` is created per generation in `state/graphData.ts`, so a reload, a new path or a fetch (`reloadToken`) cannot mix pages of two histories.
  - A failed page keeps the rows already loaded and stops. Scrolling does not retry it (a broken repository would loop); "Try again" does. A first-page failure shows the git message and a "Try again" button.
  - The selection is a commit hash, not an index, so it survives a reload. A selected commit that is no longer in the list closes the panel.
  - Row column order follows PLAN.md (subject, author, date, hash). `GraphRow/README.md` lists hash before author; the geometry is the same.
  - Ref badges: the default branch and its remote twin use the `main` look, other local branches `feature`, other remotes `project`, tags `tag`. The checked-out branch is bold. Badges shrink before the subject does, and the subject keeps at least 12 characters.
  - The graph column is as wide as the widest row being drawn (visible rows plus overscan), as `GraphRow/README.md` says, so it can change width while scrolling. It is not capped: a history with 40 lanes gives a 640 px graph column.
  - The commit detail is a side column. Under 640 px of pane width (a CSS container query, no JS) it becomes a drawer over the list. This is only the detail panel's part of the Phase 8 narrow-pane item; the rest (hiding author and date, icon-only buttons, the `ResizeObserver` hook) is still Phase 8.
  - Keyboard: Up, Down, PageUp, PageDown, Home, End move the selection and Escape closes the panel. The list is a `listbox` with `aria-activedescendant`. Phase 10 still owns the shortcut list in the README.
  - Detail shows the message body without its first line (the title already shows it) and caps the file list at 300 until "Show all". A merge commit shows its diff against the first parent, as `git.ts` does.
  - `RefBadge` gained an optional `current` prop.
- **Not verified:** Real GitHub or GitLab remotes (the fixture remote is a local bare repo). A repository with a detached HEAD. A history with more than 3 lanes at once was drawn (the fixture has up to 3 at a time) but 10 or more were not. Window sizes below 760 px. A history over 1,611 commits, and the cost of copying the rows array per page past several thousand commits.

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
