# Decisions

Newest first. Template:

## YYYY-MM-DD: Title

- **Question:**
- **Options considered:**
- **Decision and why:**

## 2026-11-07: Phase 16 scope (line-level staging)

- **Question:** how to stage single lines safely, and what stays out.
- **Options considered:** a new pair of `stageLines` calls vs an optional `lines` on the hunk request; line selection across several hunks vs one hunk at a time; patching the index directly vs `git apply --cached`.
- **Decision and why:**
  - An optional `lines: number[]` on `HunkRequest`. The 14b path already re-reads the diff, checks the fingerprint and builds the patch in main, so a line selection is only a list of positions in that hunk. No new call, channel or confirm is needed, and the renderer still never sends patch text.
  - One hunk per call. After a stage the diff changes and the indexes shift, so the UI clears its selection and reloads. Selecting across hunks would need to replay several patches against a moving diff.
  - The patch is a pure function, `linePatch`, built from the raw hunk text so every byte is kept. Staging keeps a selected line, drops an unselected added line and turns an unselected removed line into context. Unstaging, which is a reverse apply on the index, swaps the last two. The counts in the header are recomputed and `--recount` is passed as a second guard.
  - Refused on purpose: a partial selection in a hunk with a `\ No newline at end of file` note (the context line would need a different ending on each side), and a file created or deleted by the change (a half-created file has no clean patch). Whole-hunk and whole-file staging still work for both. `FileDiff.change` lets the UI hide the checkboxes instead of failing.
  - Line-level discard stays out: it destroys work, and the confirm and undo story is a separate design. Selection across several hunks or files, and drag selection, also stay out.
  - Still out: interactive rebase, line-level discard, a full-file three-way editor, `rerere`, external merge tools, submodule conflicts, pull or merge request creation, OAuth sign-in, a SQLite cache, auto-update and installers, more than two panes, drag-and-drop between projects, cloning every repository of a project at once.
- **Not verified:** this entry records a plan. Nothing in Phase 16 is built yet.

## 2026-11-06: Phase 15b as built

- **Question:** where the conflict editor lives, how a save works, and what a live run showed.
- **Decision and why:**
  - The editor is a 960 px dialog mounted in `RepoPane`, like the diff, Tags and Stash dialogs, so each pane owns its own (`conflictFile` state) and nothing is global. It opens from a file in the operation banner or from a conflicted row in the Changes panel (the row, or its new "Resolve conflicts in" button). The Changes route also serves a conflicting `stash pop`, which has no banner.
  - The choices live in the editor, keyed by the file's fingerprint: a fresh reading of the file starts again. "Save and mark resolved" is enabled once every region has a choice and closes the dialog when main reports the file staged. "Save for later" keeps partial work and shows when some regions are still open. The preview and the Edit box start from the same `applyResolutions` that main uses, so what is shown is what is written.
  - The two sides are named in words with a check, "Chosen" and a status badge, never by colour alone. Line numbers are those of the file as read, so they match another editor. A common ancestor shows in a collapsed `details` only when the file has one.
  - `OperationState` gained `conflictKinds`, so the banner can say "both modified" or "deleted on one side, changed on the other" beside each file. The banner's file names are buttons that open the editor, capped at five with "Show N more".
  - The quick "Mark as resolved" button in Changes used to stage the file as it was, markers included. A file staged that way left the conflicted list, so Continue's marker check never saw it and the markers could be committed. It now runs `resolveConflictFile` with `quickAction(kind)`: `mark-resolved` for a file with markers (refused while a marker line remains), `keep` for delete-versus-modify, `delete` (confirmed) for both-deleted.
  - Boards: the files in `docs/ui-boards/` are design templates for a runtime that is not in the repo, so a board for the editor was not drawn. The gap stays open here and in `PLAN.md`. The editor uses tokens only, with no hex values.
- **Verified in a live window:** the built app was started with Electron 44 and a remote-debugging port, on a scratch repo with a conflicting merge (two regions in one file, plus a file deleted on one side and changed on the other). The banner listed both files with their kinds. The editor opened from the banner and from the Changes panel, in light and in dark. Accept Current, Accept Incoming, Edit result and the result preview worked, and Save and mark resolved wrote the expected file and staged it. The whole-file panel kept the other file, and Continue finished the merge. The quick button refused a file that still had markers.
- **Not verified:** use with the keyboard only, a screen reader, a pane narrower than 760 px (the sides stack by CSS), two editors in Split View at once, a very large file, a diff3 file in the window (parsed and tested, not drawn), and Windows or Linux.

## 2026-11-06: Phase 15a as built

- **Question:** how the conflict data layer reads files, what it refuses, and where it differs from the plan.
- **Decision and why:**
  - `getConflictFile` reads the work-tree file and parses its markers (`shared/conflict.ts`). `resolveConflictRegions` takes `{ path, fingerprint, choices }`, re-reads the file, checks the fingerprint, re-parses, builds the text itself and writes it through a temp file in the same folder, keeping the file mode. A `null` choice leaves a region open with its markers as read, so a half-done file can be saved. The file is staged only when no region is open and no marker line is left, which also covers edited text that itself contains a marker.
  - The fingerprint is SHA-1 of the file bytes, computed in main with `node:crypto`. The plan put `conflictFingerprint` in `shared/`, but only main ever computes it, so it stays out of code the renderer bundles.
  - A file is text only if it is a plain file, under 2 MiB, free of NUL bytes and valid UTF-8 (the bytes survive a decode and encode round trip). Anything else is `binary` or `too-large` and gets the whole-file actions only. Writing a Latin-1 file back through UTF-8 would corrupt it.
  - `symlink` is the reason for any path that is not a plain file inside the repository: a symlink, or a path that passes through a symlinked folder out of the repo. Such a path is never read or written. `stillMarked` (used by Continue) now follows the same rule, so it can no longer read through a symlink. Its 5 MiB scan limit is unchanged.
  - The parser keeps every line's own `\r` so a CRLF or mixed file is written back byte for byte. Edited text takes the file's dominant line ending. A second `=======` inside one conflict, a nested block, an unclosed block and a stray `<<<<<<<` or `>>>>>>>` line are refused (`unparseable`, with the line number) instead of guessed at. A lone `=======` outside a conflict is plain text.
  - Whole-file actions are `ours`, `theirs`, `keep`, `delete` and `mark-resolved`. Which apply depends on the kind (`conflictActions`). `ours` and `theirs` use `checkout --ours|--theirs` then `add`. `delete` is `rm -f`, and the service asks first. A declined confirm returns `false` and changes nothing. A submodule conflict (mode 160000 in the index) only allows `delete`.
  - The file must be one that `git status` lists as conflicted at that moment. A path that starts with `-` is only accepted if such a file really exists, and `--` goes before every path.
  - The calls take their sides from `status`, not from the operation, so a conflicting `stash pop` works (labels "Current" and "Stash").
  - `getOperation` was split into `findOperation` (kind and target) and the status read, so the conflict call can name the operation without a second status run.
- **Not verified:** no screen exists yet in 15a. A file with no final newline whose last region ends the file was not checked against how git writes the closing marker. Windows paths were not checked.

## 2026-11-06: Phase 15 scope (merge-conflict editor)

- **Question:** what an in-app conflict editor is, how much of it to build now, and how it stays safe.
- **Options considered:** a full three-pane file editor (Monaco-style) vs a region-by-region resolver vs line-level picks; one phase vs two.
- **Decision and why:**
  - A region-by-region resolver. The user sees each conflict block with the two sides (and the base when the file has one), picks current, incoming or both, or edits that block's text, and sees the whole result below. That fixes almost every real conflict without a code editor, adds no dependency (runtime deps stay `react` and `react-dom`) and stays testable as pure functions. A full-file editor and line-level picks stay out.
  - Two phases, as with Phase 14. 15a is the git and parsing layer plus whole-file actions (it has no screen), so the risky part is proven by temp-repo tests first. 15b is the screen on top.
  - The parser reads the markers in the work-tree file, not the three index stages, so edits the user already made elsewhere are kept and the editor shows what is on disk. The cost is that unusual marker text is refused instead of guessed.
  - The renderer sends choices (`ours`, `theirs`, `both`, `base`, or edited text for one region) and a content fingerprint, never the whole file. Main re-reads, checks the fingerprint, re-parses, builds the result and writes it atomically. This is the same shape as hunk staging in 14b. Only paths that `git status` reports as conflicted are accepted, and symlinks, paths outside the repo and submodule conflicts are refused.
  - Ours and theirs swap in a rebase. The screen therefore says "Current / Incoming" or "Upstream / Your commit" in words, chosen by the operation kind.
  - Delete-versus-modify, add/add and binary conflicts have no regions. They get whole-file actions only (keep, delete, use current, use incoming), and delete is confirmed in main.
  - The editor works from `status`, so it also serves a conflicting `stash pop` that has no operation banner.
  - Continue keeps its marker check, so a half-resolved file cannot be committed.
  - Still out: interactive rebase, line-level staging, a full-file three-way editor, `rerere`, external merge tools, submodule conflicts, pull or merge request creation, OAuth sign-in, a SQLite cache, auto-update and installers, more than two panes, drag-and-drop between projects, cloning every repository of a project at once.
- **Not verified:** this entry records a plan. Nothing in Phase 15 is built yet.

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
  - The commit detail is a side column. In Split View, or under 640 px of pane width (the `narrow` prop), it opens in a row under the graph instead (40% of the graph area, at least 160 px; `detailPlacement` in `splitLayout.ts`). This replaces the earlier drawer. This is only the detail panel's part of the Phase 8 narrow-pane item; the rest (hiding author and date, icon-only buttons, the `ResizeObserver` hook) is still Phase 8.
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

## 2026-11-06: shadcn/ui with Tailwind v4, our tokens kept

- **Question:** the user asked to use shadcn, which needs Tailwind, Radix, cva, clsx and tailwind-merge. That conflicted with "runtime dependencies are `react` and `react-dom` only" and with CSS Modules.
- **Options considered:** full migration; shadcn for overlays only; new components only. Keep our look or take shadcn's default theme. List the packages as `dependencies` or `devDependencies`.
- **Decision and why:** full migration, our look kept, packages in `devDependencies` (Vite bundles them, so the packaged app still has only `react` and `react-dom` as runtime dependencies).
  - `shadcn.css` maps shadcn's variable names onto `tokens.css`, and dark is `data-theme='dark'` through a custom variant, so tokens stay the single source of truth.
  - shadcn's lowercase file names would collide with our PascalCase ones on a case-insensitive disk, so the shadcn source lives in our existing `ui/*.tsx` files and keeps their exports.
  - Our `Button` variants keep their names (`default` outlined, `primary` filled, `ghost`) so call sites do not change.
  - Radix only restores focus to a `Trigger`, so `Modal` and `Menu` remember their opener. Both are opened by mounting.
  - Element resets in `global.css` sit in `@layer base`, so Tailwind utilities beat them. Unlayered CSS Modules still beat utilities until each module is converted.

## 2026-11-06: git write features (Phases 11 to 13)

- **Question:** v1 was read-only, and `PLAN.md` listed staging, commit, diff, cherry-pick and rebase as non-goals. The user now wants a full Git client.
- **Options considered:** one large phase vs three; a Changes tab vs a panel in the graph vs a separate window; stopping at cherry-pick and merge vs adding rebase vs a conflict editor.
- **Decision and why:**
  - Three phases, each on its own branch: 11 changes, diff, stage and commit; 12 branches, checkout, push and pull; 13 stash, cherry-pick and merge. Smaller phases are easier to verify, and every write to a real repo is irreversible.
  - A `Changes` tab in `RepoPane`. Tab state is already per pane, so Split View keeps working with no global "current repo".
  - Cherry-pick and merge detect conflicts and offer Abort and Continue. There is no conflict editor and no rebase: they are the largest and riskiest pieces and only make sense once the rest is proven. Both stay in Non-goals.
  - Write calls go through the existing `guard()`, `linkedRepoKey` and `once()` helpers. Paths follow `--`, messages go in on stdin, and destructive actions use `ui.confirm`.
  - Pushing needs a token with write access, which v1's read-only scopes do not have. The README token section changes in Phase 12. Reads keep working with the old scopes.
  - Known limit carried over: git auth is injected for the account's origin only, so a remote on a different host fails with a message instead of prompting.
  - No design boards exist for staging, diff or stash. They are added under `docs/ui-boards/` before the screens are built, or the gap is logged here.

## 2026-11-06: Phase 11 as built

- **Question:** how to serialise writes, where the commit-file diff opens, and what to do about design boards.
- **Decision and why:**
  - Writes to one folder go through a per-path promise queue (`serial` in `service.ts`). `once` would hand the second caller the first caller's result and drop its arguments.
  - Every path argument must be a path `git status` lists (or the old side of a rename), then goes after `--`. This also rejects `-flags` and paths outside the repository.
  - `discard` asks through `ui.confirm` in main and resolves `false` when declined, so the renderer cannot skip the prompt.
  - A commit's file diff opens in a wide dialog from the graph's detail panel (280 to 360 px is too narrow). The Changes tab shows its diff beside the lists, or under them in a narrow pane.
  - The Changes tab stays mounted after the first visit, so a half-written message survives a trip to another tab. It reads the folder again whenever it becomes visible.
  - Design boards for Changes and the diff were not made. The screens use existing tokens and components only. Boards are still owed.
  - Hunk staging (stretch goal) and the `dirtyFiles` link to the tab were left out.

## 2026-11-06: Phase 12 as built

- **Question:** how branch, pull and push calls pick a remote and sign in, what a force push and a delete may do, and where the renderer reads tracking counts.
- **Decision and why:**
  - The remote is read from git's own config, never from the caller: the current branch's upstream remote, else `origin`, else the only remote. With several remotes and none named `origin`, it refuses to guess. Push sets the upstream only when there is none, and plain `git push` otherwise, so git's `push.default` refuses a differently named upstream instead of creating a stray branch.
  - A token goes to the account's own origin only (`remoteAuthEnv`). An HTTPS remote on another host fails before git starts, with a message naming both hosts. SSH and local-path remotes get no token. `GIT_TERMINAL_PROMPT=0` already stops any prompt.
  - Pull is `--ff-only` unless the user picks "Pull and merge" (`--no-rebase --no-edit`, so a `pull.rebase` setting and an editor stay out of it). A diverged fast-forward becomes a plain "the branches have diverged" message.
  - Force push is `--force-with-lease` only, asks through `ui.confirm` in main, and is offered only when there is an upstream.
  - Branch delete is `git branch -d`, never `-D`: git refuses unmerged work and the message reaches the user. The current branch is refused in `git.ts`, and the context menu does not offer it. The remote branch is never touched.
  - Branch names are checked with `git check-ref-format --branch` and a leading `-` is refused. Existing names must exist as `refs/heads/` or `refs/remotes/` before they reach git.
  - One pull or push per folder at a time (`remoteBusy`). Pull also joins the write queue, because it changes the work tree. Push does not, so staging stays usable while it uploads.
  - `clone:progress` became `git:progress` and carries `op` (`clone`, `pull`, `push`). A failed run reports the last few non-progress stderr lines, so a rejected push says why.
  - Branches and tracking counts come from a new `local.branches` call (a few `for-each-ref` runs) that every linked pane reads, instead of widening `getLocalInfo`, which runs a dozen commands and only the Info tab needs.
  - The right-click menu on a graph row or ref badge is built from the pure `refActions`, so it is tested without a DOM.
- **Not verified:** none of the new screens (branch menu, split Pull and Push buttons, name dialog, graph context menus) was run in a live Electron window, and no dark and light boards exist for them. The git, service and pure-logic layers are covered by tests. Remote branch lists are not capped, so a repository with thousands of remote branches gives a long menu.

## 2026-11-06: Phase 13 as built

- **Question:** where the stash list lives now that the Changes tab is gone, how a stopped merge or cherry-pick is found and finished, and how stash entries are named safely.
- **Decision and why:**
  - The stash list and the "Stash changes" form sit in a Stash dialog opened from a `Stash · n` button in the repo header. `PLAN.md` put the list in the Changes tab, but Changes is now the graph's WIP panel, which exists only while the tree is dirty. A stash is most useful when the tree is clean, so the list needs a place that is always there.
  - Every stash call carries the entry's index and its commit hash. Git renumbers the list on each push or drop, so a stale index would hit the wrong stash. A mismatch fails with "The stash list changed". Drop is confirmed in main.
  - A stash message goes in as the value of `-m`, so a message such as `--include-untracked` stays text.
  - Cherry-pick and merge return `{ conflicted: true }` when they stop on conflicts and throw for everything else. A run that stops with nothing to resolve (a cherry-pick that became empty) is aborted and reported as "already in the branch". A failed start with no state left (local edits in the way) is a plain error.
  - Cherry-picking a merge commit is refused and not offered in the menu: it needs `-m <mainline>` and a choice the UI does not have.
  - Only one merge or cherry-pick at a time. The state is read from `MERGE_HEAD` and `CHERRY_PICK_HEAD` through `rev-parse --git-path`, so a state left from a past session, another tool, or a conflicting "Pull and merge" shows the same banner on open.
  - Continue stages the files that were conflicted, then runs `commit --no-edit` (merge) or `cherry-pick --continue` with `GIT_EDITOR=true`. It refuses while a conflicted file still holds a `<<<<<<<` or `>>>>>>>` line, so unfixed markers are not committed. Deleted files count as resolved. Abort is confirmed in main and undoes the conflict fixes too.
  - The banner sits in the pane header, not in the graph, so it shows on every tab. Merge entries on a branch or remote badge say which branch they merge into, with a second entry that always makes a merge commit (`--no-ff`). Neither is offered with a detached HEAD.
- **Not verified:** none of the new screens (Stash button and dialog, conflict banner, merge and cherry-pick menu entries) was run in a live Electron window, and no dark and light boards exist for them. The git, service and pure-logic layers are covered by temp-repo and unit tests.

## Auto-refresh on disk changes

- The app now follows edits made outside it. Main watches each linked folder with Node's `fs.watch` (recursive, no chokidar: `dependencies` stays `react` and `react-dom`, no native modules) and its git dir, resolved with `rev-parse --absolute-git-dir --git-common-dir` so linked worktrees work. `objects/`, `logs/`, `*.lock` and `FETCH_HEAD` in the git dir, and `.git/` and `node_modules` in the worktree, are ignored. Events are debounced 300 ms and sent as `repo:changed`.
  - One watcher per folder, reference-counted in the service, so two panes on the same repo share it.
  - Git runs with `GIT_OPTIONAL_LOCKS=0` so our own `git status` does not rewrite the index and trigger the watcher.
  - The renderer keeps a `watchToken` apart from `reloadToken`. It reloads status, diff, branches, stashes and the operation banner. The graph reloads only when HEAD moves (`status.head`) or the WIP state flips, so typing in an editor does not reset graph pages and scroll. A branch created or deleted without a new commit does not redraw the graph until the next reload.
  - A throttled window `focus` listener bumps the same token, as a net for folders that cannot be watched. Events are ignored while an app action runs, because that action refreshes at the end.
- **Not verified:** not run in a live Electron window. The watcher is covered by a temp-repo test (edit, commit, checkout, stop).

## 2026-11-06: Phase 14 scope

- **Question:** which Git operations come next after stash, cherry-pick and merge, and whether the non-goals list still holds.
- **Decision and why:**
  - Phase 14 is split. 14a (tags, revert, reset, remotes) is independent and low risk. 14b (non-interactive rebase and hunk staging) is riskier because rebase has its own in-progress state and ends in a force push, so it ships second.
  - Non-interactive rebase and hunk staging move out of the non-goals list. Hunk staging was the Phase 11 stretch goal.
  - Still out: interactive rebase, a merge-conflict editor, line-level staging, pull or merge request creation, OAuth sign-in, a SQLite cache, auto-update and installers, more than two panes, drag-and-drop between projects, cloning every repository of a project at once.
  - Revert, reset and rebase reuse the Phase 13 operation banner (state from `.git` files, Continue, Abort) and Phase 12's confirm and `--force-with-lease` rules. A hard reset is confirmed in main.
- **Not verified:** this entry records a plan. Nothing in Phase 14 is built yet.

## 2026-11-06: Phase 14a as built

- **Question:** where Remotes live, how a tag finds its remote, what a reset may do, and how revert fits the operation banner.
- **Decision and why:**
  - Remotes are a dialog opened from the repo header, next to Tags and Stash. `PLAN.md` said "repo settings", but the app has no settings page for a repository and one dialog is enough.
  - A tag goes to `origin`, else the only remote (`getTagRemote`). Unlike pull and push it needs no checked-out branch, since a tag belongs to no branch, so it works with a detached HEAD. Several remotes and none named `origin` is refused, never guessed. The auth header is scoped to that remote's host through the same `remoteAuthEnv`.
  - Deleting a tag removes the local tag only. Deleting it on the remote is a separate, confirmed button. Tag messages go in on stdin. A tag created with a message is annotated.
  - Revert reuses the Phase 13 banner: `REVERT_HEAD` is found by `getOperation`, and Continue and Abort run `revert --continue` and `revert --abort`. A merge commit and a detached HEAD are refused. A revert that stops with nothing to resolve is aborted and reported as already undone.
  - Reset is offered on every commit, merge commits included (a reset needs no mainline), and is refused while a merge, cherry-pick or revert is in progress. Only `hard` asks first, and the confirm says how many commits leave the branch and how many tracked files are overwritten (`getResetImpact`). Untracked files are never touched by a reset.
  - Remote names are checked with `check-ref-format` and may not start with `-`. URLs may be `https`, `http`, `ssh`, `git`, scp-style `user@host:path` or a path. A URL with a username, password or token is refused so no secret reaches `.git/config`, and `::` is refused so no remote helper (`ext::`) can run a program. Removing a remote asks first, because it deletes the remote-tracking branches.
  - The "no operation" error is now one shared text, "There is no merge, cherry-pick or revert in progress".
- **Not verified:** none of the new screens (Tags and Remotes dialogs, the graph menu entries, the revert banner) was run in a live Electron window, and no dark and light boards exist for them. The git, service and pure-logic layers are covered by temp-repo and unit tests.

## 2026-11-06: Phase 14b as built

- **Question:** how a hunk is named safely, what a rebase may start from, and how a rebase fits the operation banner.
- **Decision and why:**
  - A hunk is sent as `{ path, source, index, fingerprint }`, never as patch text. Main re-reads the file's diff (`--unified=3`, the same flags as `getDiff`), checks that the hunk at `index` has the same fingerprint (FNV-1a over line types and text, `hunkFingerprint` in `shared/diff.ts`) and builds the patch itself from the `diff --git` header and that hunk. A file that changed since the diff was read is refused with "Reload the diff and try again". The patch goes to `git apply --cached` (with `--reverse` to unstage) on stdin. The work tree is never touched.
  - Hunk staging is refused for untracked, conflicted and renamed files, and for binary or too-large diffs. The button is hidden in those cases and main checks again. Line-level staging stays out.
  - Rebase takes a local branch, a remote branch (`origin/x`) or a commit hash, checked as `refs/heads/`, then `refs/remotes/`, then a commit. It is non-interactive: `rebase.autoStash` and autosquash are switched off for the run and `GIT_EDITOR` and `GIT_SEQUENCE_EDITOR` are `true`. A branch cannot be rebased onto itself, HEAD must be a branch, and tracked edits must be committed or stashed first (untracked files are fine). The "already in progress" check comes first, because HEAD is detached during a rebase.
  - A running rebase is found from `rebase-merge` or `rebase-apply` (not when `rebase-apply/applying` exists, which is `git am`), and wins over `CHERRY_PICK_HEAD`. Its target is the short hash in `onto`. Continue and Skip do not fail when the next commit conflicts in turn: the banner shows the new files. Skip asks first, is only for a rebase, and drops the commit it stopped on. Abort is the existing confirmed abort.
  - Rebase never pushes. A rebased branch that was already pushed needs the existing confirmed force push with lease.
  - The rebase entries are offered on branch and remote badges and on any commit row, never during another operation and never with a detached HEAD.
- **Not verified:** none of the new screens (the Stage hunk and Unstage hunk buttons, the rebase menu entries, Skip in the banner) was run in a live Electron window, and no dark and light boards exist for them. The git, service and pure-logic layers are covered by temp-repo and unit tests.
