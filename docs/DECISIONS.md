# Decisions

Newest first. Template:

## YYYY-MM-DD: Title

- **Question:**
- **Options considered:**
- **Decision and why:**

## 2026-11-27: macOS installer window (DMG design E-1 Sunrise)

- **Question:** how the DMG installer window is built, what is tied to what, and whether README must change.
- **Options considered:** keep the SVG source in the repo and render it at build time; ship a pre-rendered PNG; add a Windows NSIS installer with the same look.
- **Decision and why:**
  - Design E-1 "Sunrise", in the Sun colours. The background is a pre-rendered PNG: `build/background.png` and `build/background@2x.png`, 660 x 400, with a commit line between the app and Applications. The SVG source is not kept in the repo.
  - The `dmg` block in `electron-builder.yml` sets the window to 660 x 400, icon size 80, the volume icon to `build/icon.icns`, and the icon positions to x 180 and x 480 at y 210. These are icon centres, on the ends of the commit line in the image. Changing the image layout or those positions means changing both.
  - macOS DMG only. There is no Windows NSIS installer. Windows and Linux are not packaged, as README already says.
  - README: no change. Install still says to drag GitDeck to Applications, which the window now shows. Known limits already says Windows and Linux are not packaged. Features and Progress are unchanged, and PLAN.md has no box for this work.
- **Not verified:** the user reports the window was checked in a mounted DMG. This entry was written from `electron-builder.yml` and the branch diff stat. The PNG files were not opened and the DMG was not built here.

## 2026-11-27: README sync for the app icon picker

- **Question:** commit 19f6410 adds an app icon choice in Settings > Appearance. How should README describe it, and what must it say it does not change?
- **Options considered:** a Features table change; a More detail bullet under Appearance; a Known limits line for what the icon does not change.
- **Decision and why:**
  - A sentence in the Appearance bullet of More detail: seven choices (Default and six built-in icons), kept between launches, set on the Dock and window icon.
  - A Known limits line: the icon changes only while GitDeck runs, the Finder and `.app` icon stays `build/icon.icns`, and Windows and Linux are not packaged.
  - No change to the Features table. The Extras row names themes and accents, and the icon is a small part of Appearance. Adding words to that row would also have shifted its table padding, and no formatter could be run to re-align it.
  - Progress is unchanged. No phase was added, and PLAN.md has no box for this change.
- **Not verified:** the icon is not checked visually in the running app. There has been no Dock check yet, so the Dock and window icon, and the six PNGs, were read from the code only. Prettier was not run on README.md.

## 2026-11-27: README sync for squash merge and menu dividers

- **Question:** the branch adds "Merge into <branch> (squash)" to the branch menu and new menu dividers. Does README need to say so, and where?
- **Options considered:** a Features table change (the "Change" row already names merge); a bullet under More detail; a Known limits line for a squash that conflicts; no change, since menu dividers are not a feature.
- **Decision and why:**
  - A "Merge" bullet under More detail (History operations). It names the three merge modes, that a squash makes one commit with no dialog, and that a squash that conflicts is undone and reported.
  - A Known limits line: a squash conflict is not resolved in the app. The "Resolve" row stays as it is, since it is still true for other merges.
  - No change for the menu dividers. They are visual only and the README does not describe the menu layout.
  - Progress is unchanged. PLAN.md has 222 ticked boxes and none open, and the squash merge is not a phase.
- **Not verified:** the squash flow and its conflict undo in a running window. This sync was done from the branch's `git diff develop...HEAD --stat`, the DECISIONS entry "Squash merge in the branch menu" The source files were not read and nothing was run.

## 2026-11-27: Overview tab for local repositories

- **Question:** Local repositories had no Overview tab and opened on Graph. Should they get one, and what can it show without a host?
- **Options considered:** not recorded. The commit message gives the decision only.
- **Decision and why:**
  - A clone-only Overview (commit cc80579). It shows the README, the 12-month commit heatmap, the latest tags and the About rows the clone can fill. Languages and contributors are hidden. License, created and size show "—". Nothing is read from a host.
  - Local tabs are Overview, Graph and Info. PR/MR stays hidden.
  - A saved PR/MR tab on a local repository opens on Graph (`RepoPane.tsx`).
  - Still left out: languages and contributors from git alone.
- **Not verified:** the Overview was not run in a window, so the "—" values and the README and heatmap output were read from code only. Not verified: which tab a newly opened local repository starts on.

## 2026-11-27: README sync for the narrow pane threshold (640 to 760 px)

- **Question:** `NARROW_PANE` in `src/renderer/src/lib/splitLayout.ts` moved from 640 to 760 px on `fix/split-header-narrow` (commit 2c48520), so panes under 760 px use the compact layout (no Author and Date columns, icon-only header buttons). Does README need to say so?
- **Options considered:** add the new threshold to Features or Known limits; leave README unchanged because it never stated the number.
- **Decision and why:** no README change. The README does not mention 640 px, the compact layout or the pane width threshold, so nothing in it is out of date. The Progress line stays at 45 of 45, matching the PLAN.md checkboxes. The 640 px figure still appears in PLAN.md (Phase 8 narrow panes) and in older entries of this file; those are historical records and were left as written.
- **Not verified:** the compact layout at 700 to 760 px in a running window. This sync was done from the source diff and the README text only, with no app run.

## 2026-11-07: Phase 19 (integrated terminal)

- **Question:** the user asked for a terminal inside the app. Phase 18 had ruled one out because it needs `node-pty`, a native module.
- **Options considered:** a pty through `script(1)` with no native module (limited resize, Unix only); `node-pty`; a one-command runner (nothing interactive).
- **Decision and why:** `node-pty`, chosen by the user. It is N-API with prebuilt binaries for macOS and Windows, so there is no compile step and no `electron-rebuild`. The rules now allow this one native module in `dependencies`; xterm.js stays a devDependency because Vite bundles it.
  - A shell starts only in a folder that is linked to a repository, the same check every other path argument gets. One shell per pane, started on the first open, hidden (not killed) on close, killed when the pane goes or the app quits.
  - The shell is a login shell (`$SHELL -l`) with `TERM=xterm-256color`. It inherits the app's environment, which holds no tokens (tokens live only in `safeStorage` and are injected per git call).
  - pnpm unpacks `node-pty`'s `spawn-helper` without the execute bit, which makes every spawn fail with `posix_spawnp failed`. Main sets the bit before the first spawn. `pnpm-workspace.yaml` allows the package's install script.
  - Ctrl+\` toggles the active pane's terminal; the key is passed through xterm so it also closes it while focused.
- **Not verified:** the panel in the running window (light and dark, resize, two panes in Split View). No boards are drawn. A real `node-pty` shell was run under Electron 45 (output and input worked), and the rest is covered by tests with a fake pty. Packaged builds (asar unpacking of `node-pty`) are untested because the repo has no packager yet. The existing `commitBlocker` test in `changes-view.test.ts` fails on `main` too and is unrelated.

## 2026-11-07: Phase 18 as built

- **Question:** what was built, what the checks showed, and what was not checked.
- **Decision and why:** a Generate button in the commit box runs the local `claude -p` with no tools and fills the message field. `tests/ai.test.ts` passes, including a fake CLI. One real call to the installed CLI returned a gitmoji message.
- **Not verified:** the button in the running window, light and dark, and a Finder-launched build finding `claude`. Dark and light boards are not drawn.

## 2026-11-07: Phase 18 scope (AI commit messages)

- **Question:** how to add AI help without a native module or a stored key.
- **Options considered:** an embedded terminal (needs `node-pty`, a native module, against the rules); a direct API call (needs a stored key); the user's own `claude` CLI.
- **Decision and why:** the CLI. GitDeck stores nothing, adds no dependency and `child_process` is built in. The staged diff (first 60 KB) leaves the machine through that CLI, so it is opt-in (off by default, Settings, AI), runs only on a click, and only suggests: it never commits or pushes. A terminal panel stays out of scope.

## 2026-11-07: Phase 17 as built

- **Question:** what was built, what the checks showed, and what was not checked.
- **Decision and why:**
  - As planned. `Menu` gained a `submenu` kind and an `onContextMenu` on items; `branchView.menuLayout` lays out the ref and commit actions with Reset and Copy as submenus; `refMenu.ts` converts that to `Menu` entries, so the graph and the branch selector share one builder. The selector's ref menu passes no commit hash, so it has no commit actions and no Reset.
  - Force delete is not a menu item: `deleteBranch` asks once, runs `branch -d`, and if git says the branch is not fully merged it asks a second time before `branch -D`. Declining either leaves the branch. Remote delete (`deleteRemoteBranch`) splits `origin/topic` by the repository's own remote names (longest first) and pushes `:refs/heads/<branch>` with the same scoped auth as other pushes.
  - Bug found in the window and fixed: `GitGraph` reused one `Menu` instance when a second menu opened at a new point, and Radix kept the old anchor. The new menu then opened under the old position, so releasing the button over an item ran it (a merge in the scratch repo). The graph menu now sets `key` from its position.
  - Follow-up on request: the selector's right-click was replaced by a chevron on each branch row that opens the same ref menu as a hover submenu (so `Menu` lost its `onContextMenu` and its submenu entry gained `trailing`). A lone Copy action is a plain item, so a branch's menu reads "Copy branch name" with no nested submenu.
  - Long branch names: ref labels no longer repeat the ref's name ("Check out", "Delete…", "Merge into main", "Merge into main (no fast-forward)", "Rebase main onto this branch"). The graph menu shows the name once as a heading above them, and every item has a tooltip with its full text. The menu is up to 380 px wide. Before, a 40-character branch name cut every label to the same prefix, so the two Merge items looked identical.
  - Tests: 476 passing; typecheck, lint, format and build pass.
  - No board in `docs/ui-boards/` shows submenus or the per-remote branch list. Tokens and existing components only. Gap logged.
- **Live check (2026-11-07):** driven over a DevTools port on a scratch repo with a bare remote. The commit menu shows four actions, a rule, then **Reset main to here ▸** (Soft, Mixed, Hard in red) and **Copy ▸**. A local badge shows Check out, Delete, Merge, Rebase, then the commit actions, Reset and Copy. A remote badge shows "Delete origin/topic on the remote…". The branch selector lists local branches, then `origin` with `main` and `topic` (twins included). Hovering a selector row (local or remote) opens its actions in a submenu beside it: Check out, Delete, Merge, Rebase, Copy branch name.
- **Not verified:** the native confirm dialogs (force delete, delete on the remote) were not clicked in the window: they are covered by the service tests only. Keyboard use of submenus (Right and Left arrow), a narrow window, and a real remote host.

## 2026-11-07: Phase 17 scope (leaner menus, Delete branch)

- **Question:** how to shorten the commit menu, add Delete branch to the graph and the branch selector, and show remote branches.
- **Options considered:** submenus vs more separators; delete local only vs also force and remote; the selector's own action menu vs a submenu arrow on each row; show only remote branches with no local twin vs every remote branch.
- **Decision and why:**
  - Submenus for Reset (soft, mixed, hard) and Copy (name, hash), because Reset has three near-identical entries and the copy items sat in two groups.
  - Delete covers local, force and remote, with a confirm each time. Force asks after git refuses, so the common safe path stays one confirm.
  - The selector's rows are submenus (chevron, opens on hover) with the same ref menu as the graph, so one builder serves both. Checking out is the first item in the submenu, one hover and click, not a click on the row. Every remote branch is listed under its remote, including ones with a local twin, so a branch can be deleted on the remote from the selector.

## 2026-11-07: Scope selector and filter moved to the toolbar

- **Question:** where the project selector and the repository filter live, and what happens when the sidebar is collapsed.
- **Options considered:** a sidebar-width block on the left of the toolbar, a compact row, or centred like a command bar.
- **Decision and why:**
  - Both sit on the left of the 48 px toolbar, after the macOS traffic-light inset: the existing `ScopeSwitcher` (210 px) and a new `RepoFilter` beside it, then the split-view buttons stay on the right. The sidebar keeps the project error banners and the "Project overview" button.
  - The filter text moved from `Sidebar` to `App`, so the toolbar writes it and the sidebar reads it. Typing while the sidebar is collapsed opens it, so the results are never hidden. The `Cmd/Ctrl+F` shortcut still finds `[data-search-input]`, now always rendered.
  - The block is hidden until there is an account, a local repository or a project scope, so an empty app has no dead filter. The toolbar drags the window, so labels are opted out of dragging as buttons already were.
  - Follow-up: the selector and filter are centred in the toolbar (a three-column grid, so they stay centred whatever the side buttons hold), the icon rail is removed, and Preferences sits at the right of the toolbar beside Split view. The rail's repositories button, which opened and closed the sidebar, is gone with it and nothing replaces it: the sidebar now stays open, and `sidebarOpen` only starts as closed for someone whose stored setting says so, until a search or Cmd/Ctrl+F opens it. The toolbar's left cell is empty, so the grid keeps the centre block centred.
  - Later: the filter went back to the sidebar header (the `RepoFilter` component stays, and `query` is the sidebar's own state again). Only the scope selector is in the toolbar, centred. Typing no longer has to open a hidden sidebar, so that code is gone.
  - Then: the scope selector is at the left of the toolbar after the traffic-light inset, and the sidebar filter is bigger (40 px tall, 14 px text, 18 px icon) so it reads as the main search.
  - No board in `docs/ui-boards/` shows this layout. It uses tokens and existing components only. Gap logged.
- **Checked in the window:** light and dark toolbar, the scope menu opens under the selector, typing filters the sidebar ("No repositories match"), and a collapsed sidebar reopens when typing. **Not checked:** dragging the window by the toolbar, a project scope with several projects, Escape behaviour by hand, a narrow window.

## 2026-11-07: Phase 16 as built

- **Question:** what was built, what the checks showed, and what was not checked.
- **Decision and why:**
  - As planned: optional `HunkRequest.lines`, `linePatch` and `FileDiff.change` in `shared/diff.ts`, `hunkPatch` in `git.ts` builds the line patch from the re-read diff after the fingerprint check, applied with `git apply --cached --recount`. `checkHunk` validates `lines` in the service. No new IPC call.
  - The renderer keeps the selection beside the diff object it was made on (`DiffView`), so a reloaded diff drops it without an effect. `lib/lineSelection.ts` holds the pure helpers. Shift-click ticks a range from the last clicked line in the same hunk.
  - Tests: `tests/line-staging.test.ts` (patch rules, CRLF, no-newline, temp-repo stage, unstage, round trip, refusals) and a service validation test. Suite: 467 passing; typecheck, lint, format and build pass.
  - The checkbox column and the "Stage N lines", "Select all" and "Clear" buttons have no dark or light board in `docs/ui-boards/`; they use tokens and the existing ghost button only. Gap logged.
- **Live check (2026-11-07):** the built app was driven over a DevTools port on a scratch repo with one hunk of two removed and three added lines. Light and dark both render the checkbox column, the red and green rows and the "Stage N lines", "Select all" and "Clear" buttons cleanly. Ticking a removed and an added line and clicking "Stage 2 lines" put exactly that pair in the index and left the work tree alone; the diff reloaded and the selection cleared. On the staged diff, "Unstage 1 line" moved only the ticked line back. A shift-click from the first changed line to the last ticked every changed line between, and the button read "Stage 4 lines". Shift was sent as a synthetic click event with the shift key set.
- **Not verified:** keyboard use and screen-reader behaviour of the checkboxes.

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
- **Not verified:** this entry records the plan. See "Phase 16 as built" above.

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
  - Local repositories show under a "Local" group at the top of the sidebar, have no PR/MR tab (no host), no Open on web and no Unlink. Remove only forgets the entry. Amended 2026-11-27: they now have a clone-only Overview tab.
  - Left out: local repositories in Projects, languages and contributors for local repositories, matching a folder's remote to an account repository, and drag-and-drop of a folder.
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
- **Known limits:** both the form's repository list and the sidebar list are virtualised since Phase 20 (`@tanstack/react-virtual`, fixed row heights, so rows must not wrap). A focused row that scrolls out of the window unmounts and loses focus. Dead dialog buttons in the sidebar: an Unavailable row's main button does nothing.
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
  - Sidebar: account, then namespace, then repos. The namespace row is a quiet group label, not a third `TreeRow` level. Repos sort by name, not by recent activity. Search covers name, full name and description, hides hosts with no match, and expands every group. Collapsed groups and the sidebar's open state persist in localStorage. The list is virtualised (Phase 20).
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

## 2026-11-07: Boards for Changes, diff and the conflict editor

- **Question:** how to close the two board gaps left in `PLAN.md` (Phase 11 and Phase 15b) when the other boards are templates for a runtime that is not in the repo.
- **Decision and why:**
  - Four boards were added: `Changes` and `Conflict`, each dark and light, 1440 x 900. They are plain static HTML with no `sc-for` and no `support.js` dependency in practice, so they open in a browser as they are. Sizes and positions are in `canvas.json`.
  - They were drawn from the current components (`ChangesPanel`, `DiffView`, `ConflictEditor`) and the values in `tokens.css`, not from the running app. Like the other boards they use literal hex values, because they are design documents and not app code. The "no hex in components" rule is unchanged.
  - The diff is drawn as the "Unstaged changes" dialog over the window, as it opens in the running app (checked in a live window on 2026-11-07). The first draft showed it inline in the pane, which was wrong.
  - The Changes board also shows the per-line checkboxes and the "Stage 3 lines", "Select all", "Clear" and "Stage hunk" buttons (Phase 16), so that gap is closed too.
- **Not verified:** the boards were checked as headless Chrome screenshots at 1440 x 900 only, not against screenshots of the running Electron window. Submenus, the terminal panel and the AI message button's loading state are still not drawn.

## 2026-11-21: Roadmap, Phases 20 to 25

- **Question:** what to build after Phase 19, and how to ship it without an Apple Developer ID.
- **Decision and why:**
  - Six phases, one branch each: sidebar virtualization, command palette, read-only PR/MR and CI, file history and blame, bisect, packaging.
  - PR/MR is read-only with "Create PR/MR" as a link to the host's compare page: it needs no new token scopes (GitLab writes would need `api`). CI status shows in the PR/MR tab and as a dot on branch pills, not on every commit row, to avoid many API calls. Data refreshes on open, on manual refresh and on focus after 60s, never in the background.
  - The palette is Mod+Shift+P because Mod+K is already search.
  - Virtualization uses `@tanstack/react-virtual` (a devDependency, bundled by Vite).
  - Blame and history are a per-file tab, so they work in Split View. Bisect is a banner in the `OperationBanner` style.
  - **Reverses** the earlier "auto-update and installers" non-goal for installers only. macOS Squirrel auto-update refuses unsigned apps, so there is no silent update: the app compares its version with the latest GitHub Release (the repo is public) and links to the download. Real auto-update waits for an Apple Developer ID and should replace only `updateCheck.ts`. Unsigned builds show a Gatekeeper warning; the README explains the workaround.
  - Packaging is macOS only for now (dmg and zip, arm64 and x64), built per architecture on native runners because of `node-pty`.
- **Not verified:** the GitHub checks and GitLab pipeline endpoints and scopes were inferred, not read from the docs. Phase 22 starts by checking them.

## 2026-11-21: Command palette (Phase 21)

- **Question:** the palette is global, but fetch, pull, branches and the terminal live inside each `RepoPane` (no global current repo).
- **Decision and why:**
  - The focused pane registers its commands in `state/paneCommands.ts` (one slot, read when the palette opens, so no re-renders). The palette keeps that snapshot, so it acts on the pane that had focus even if focus moves.
  - A branch runs checkout (as the branch menu does). A tag switches that pane to the graph and selects its commit, loading more history until found. Tags load when the palette opens, not per pane.
  - Pull uses fast-forward only, the safe default. Theme cycles System, Dark, Light. At most 50 results.
  - Not opened over another dialog, same rule as Mod+K.
- **Not verified:** no display here, so the look, focus return and Split View behaviour were not checked by eye.

## Focus ring on text fields

The 2px focus ring looked heavy on text inputs (palette, filters, forms). Text inputs and textareas now drop the ring and tint their border to `accent-text`; every other focusable element keeps the ring.

## 2026-11-21: Pull requests, merge requests and CI (Phase 22)

- **Question:** which endpoints and scopes give read-only PR/MR and CI data, and what happens when a host lacks them.
- **Checked against the official docs** (docs.github.com, docs.gitlab.com):
  - GitHub: `GET /repos/{r}/pulls`, `GET /commits/{ref}/check-runs` and `GET /commits/{ref}/status` (the combined status). The classic `repo` scope covers them. Fine-grained tokens need the Checks and Commit statuses read permissions.
  - GitLab: `GET /projects/:id/merge_requests` and `GET /projects/:id/pipelines?ref=`. `read_api` covers reads.
  - Not confirmed from the docs: whether the MR list includes `head_pipeline`, so the app does not rely on it. It asks the pipelines endpoint for the latest pipeline of the source branch instead.
- **Decision and why:**
  - Lists are the 100 most recently updated requests (two pages of 50, any state), so a big repo costs two calls.
  - CI is read per open request when its row shows, and once for the checked-out branch (the dot on its pill). Not per commit.
  - A 403, 404 or other 4xx on a checks endpoint (CI off, old self-hosted version) is "no CI info". A 401 and a 5xx still fail, so a bad token is not hidden.
  - GitHub checks merge check runs and legacy statuses; the worst item sets the state. GitLab pipelines `skipped` and `manual` count as no info.
  - The PR/MR tab is hidden for local-only repos. "Create PR/MR" opens the host's compare page (`/compare`, `/-/merge_requests/new`).
  - Reads happen when the tab opens, on Refresh, and on window focus when older than 60s. No polling.
- **Not verified:** no real GitHub or GitLab host and no display here, so the live check and the look of the tab and dot were not done.

## 2026-11-21: File history and blame (Phase 23)

- **History:** `git log --follow --name-only`, 50 per page (one extra row read to know if there is a next page). Each entry carries the file's name at that commit, so a rename shows the old path.
- **Blame:** `git blame --porcelain`, parsed by the pure `shared/blame.ts`. Opened from a commit's diff it blames that commit; opened from the changes list it blames the work tree, so uncommitted lines show as "Not committed yet". A NUL byte in the output means a binary file: no lines.
- **Where it opens:** a "History" button in the diff dialog (reached from the changes list and the commit detail) adds a file tab to the pane. The tab is pane-local state, not saved with the Split View layout; one file per pane, a new file replaces it. Clicking an entry or a blame line switches to the graph and selects that commit.
- **Limit:** blame has no paging and renders every line, so a very large file is slow to draw (shortcut: virtualise if it shows).
- **Not verified:** no display here, so the tab, the buttons and two-pane behaviour were not checked visually.

## 2026-11-21: Bisect (Phase 24)

- **Separate state:** bisect is not an `OperationKind`. Continue, Abort and Skip on the operation banner mean merge-like things, so a running bisect has its own `BisectState` and `BisectBanner`. It still counts as "busy": merge, rebase, cherry-pick and revert refuse to start, and the graph menu hides them.
- **State reader:** a bisect is running when `BISECT_START` exists in the git dir (`gitDirs()`, so linked worktrees work). Marks and the final "first bad commit" line come from `BISECT_LOG` via the pure `shared/bisect.ts`. The commit under test is HEAD.
- **Start:** "Bisect: mark as bad" on a graph row remembers the commit in the pane (not saved); the next row menu offers "Bisect: mark as good" and starts. Git needs a clean-enough work tree; its own error is shown if not.
- **Limits:** no "steps remaining" estimate. If skips leave git unable to decide, git's error is shown and the bisect stays open: abort it.
- **Not verified:** no display here, so the banner and menu were not checked visually; the verifier and design-qa agents were not run.

## 2026-11-21: Phase 25 packaging and update notice

- **Decision:** electron-builder (devDependency), unsigned dmg and zip for arm64 and x64, appId `com.gitdeck.app`. `node-pty` is in `asarUnpack` and `npmRebuild` is off: its prebuilds (`darwin-arm64`, `darwin-x64`) and `spawn-helper` land in `app.asar.unpacked` and the release workflow builds one architecture per runner. The update check is manual only (Settings, About) and reads the latest GitHub release without a token; a 404 means "no release yet".
- **Verified:** `pnpm package` builds both architectures; `app.asar.unpacked` holds `pty.node` and an executable `spawn-helper`; 529 tests pass.
- **Not verified:** launching the packaged app and its terminal, the About section in a window, signing and notarisation, the workflow (needs a pushed tag), the x64 app on Intel.

## 2026-11-22: Ad-hoc signing for the macOS release

- **Decision:** `electron-builder.yml` sets `mac.identity: '-'` (ad-hoc) and `hardenedRuntime: false`, replacing `identity: null`. The release workflow is one `macos-15` job that builds both architectures with `--publish never`.
- **Why:** v0.1.2 downloaded in a browser showed "GitDeck is damaged and can't be opened": Apple silicon will not launch an app that has no signature at all once it is quarantined. An ad-hoc signature turns that into the normal "unidentified developer" prompt. Hardened runtime is off because library validation rejects Electron's own frameworks under an ad-hoc signature (electron-builder 26 docs).
- **Verified:** local `--mac --dir --arm64` build: `codesign -dv` shows `Signature=adhoc`, `codesign --verify --deep --strict` passes, and the app starts (main and helper processes, run with a separate `--user-data-dir` because of the single-instance lock).
- **Not verified:** the quarantined download from a browser (needs the released build), notarisation (needs a Developer ID), the x64 build on Intel.

## 2026-11-22: Release knowledge and a releaser subagent

- **Decision:** `docs/RELEASING.md` holds the release flow, the run check and the gotchas; `.claude/agents/releaser.md` is a thin agent that follows it. `CLAUDE.md` and `AGENTS.md` point to it.
- **Why:** v0.1.0 to v0.1.2 were tagged before a release built, for reasons nobody had written down (retired runners, implicit electron-builder publish, no signature, a login-PATH bug). The doc is the single source; the agent only applies it.
- **Not built:** workflow-generated release body, notarisation, an Intel test runner (listed under Ideas in the doc). The `git push` deny rule stays: the user pushes.
- **Not verified:** that a fresh agent follows the doc end to end (needs a real release).

## 2026-11-22: Roadmap 2, Phases 27 to 32

- **Decision:** the user's priority order is line-level discard, create PR/MR, more AI providers, change log, interactive rebase, notifications. Planned in `PLAN.md`; nothing is built.
- **Why this order:** small and low-risk first (discard reuses line staging); create PR/MR is the most-used missing workflow; AI extends an existing Settings section; interactive rebase is the largest and riskiest, so it follows once the rest is stable.
- **Webhooks changed to polling:** a desktop app has no public URL for a host to call, and a relay server would break the "no runtime dependencies, tokens stay local" model. Phase 32 polls PR/MR lists while the app is open. Accepted when Phase 32 started (2026-11-24).
- **Open questions:** (1) what "change log" means: commits between two tags (the Phase 30 default), GitDeck's own "what's new", or host release notes; (2) AI order: HTTP APIs first (the plan's default) or CLI agents first; (3) ship each phase as its own release, or batch 26 to 28 as v0.2.0.
- **Scope change to log when built:** GitLab creation needs the `api` scope instead of `read_api` (Phase 28).

## 2026-11-22: Release workflow, Phase 26

- **Decision:** `develop` (integration), `stage` (release candidate, published as a `-rc` pre-release), `main` (released code only). Features and fixes branch from `develop`; hotfixes from `main` and are merged back into `stage` and `develop`. Commands `stage`, `release` and `hotfix` automate it locally; the user still pushes.
- **Why:** the packaged app is where past release bugs showed up (v0.1.0 to v0.1.2, the terminal helper), so an installable rc is worth a step before `main`. Without an rc build, `stage` would only be an extra merge.
- **Trade-offs:** `stage` is all or nothing (an unfinished feature already in `develop` cannot be held back; keep it on its own branch). Fixes found while testing go on a branch from `stage` and are merged back into `develop`. Phases 27 to 32 were renumbered from 26 to 31 so this phase comes first.
- **Not decided:** whether `develop` becomes GitHub's default branch (the user's call).

## 2026-11-23: Phase 27 as built (line-level discard)

- **Decision:** `discardLines` reuses `hunkPatch` and `linePatch` with the `unstage` direction (unselected `+` stays as context, unselected `-` is dropped), applied with `git apply --reverse` to the work tree. No second patch builder.
- **Why:** the work-tree diff is index to work tree, so reverting chosen lines is the same patch an unstage builds. `git apply` writes all or nothing, and the fingerprint check refuses a file that changed since the diff was read.
- **Confirm:** asked in main through `ui.confirm` (names the file and line count, says it cannot be undone), like `discard`. A declined prompt resolves `false`.
- **Limits:** tracked files with a text diff only. Untracked, created, deleted, renamed, conflicted and binary files stay whole-file. Not undoable.

## 2026-11-23: Phase 28 as built (create PR/MR)

- **Endpoints (read from the official docs on 2026-11-23):** GitHub `POST /repos/{owner}/{repo}/pulls`: `head` and `base` required, `title`, `body`, `draft` optional, answers 201; 403 and 422 are listed. GitLab `POST /projects/:id/merge_requests`: `source_branch`, `target_branch`, `title` required, `description` optional. The docs do **not** say, so these stay unverified: GitHub's classic-PAT scope and error-body shape (`message`, `errors[]`); for GitLab the success code, the 409/403/422 behaviour on create, the error body, and the `Draft: ` title prefix (there is no `draft` create parameter; the prefix is GitLab's convention, not in the create section). GitLab's `api` scope is inferred from the scopes page ("complete read and write access"); `read_api` is read-only. Error parsing accepts several shapes and falls back to the status text, so none of the unverified points can break creation.
- **Scope change:** GitLab creation needs `api` (it includes `read_api`). The "Create token" link and README now ask for `api` + `read_repository`. Tokens that only have `read_api` keep reading; creation answers 403 and the dialog offers the host's own page.
- **Errors:** `postJson` puts the host's own `message` / `errors[].message` (capped at 300 characters) after the status, so 422 "already exists" is readable. GETs keep the short text. Request headers are never in a message.
- **Same origin:** the result's `webUrl` is blanked if it points off the host we called; the dialog then does not open it.
- **Dialog:** needs a linked clone with a checked-out branch (it reads the last commit subject and can push). Otherwise "Create PR/MR" still opens the browser page. "Push first" pushes the checked-out branch only (`local.push`, sets upstream when missing). Head and base are plain branch names in the same repository: no forks.

## 2026-11-23: Phase 29 as built (more AI providers)

- **Interface:** `suggest(provider, prompt, options)` in `src/main/ai.ts`, one function per provider. Every provider gets the same `buildPrompt` output, so the 60 KB diff cap applies to all. HTTP first (OpenAI, Gemini, OpenAI-compatible), then CLIs (Codex, OpenCode), as the plan defaulted.
- **Keys:** `Store.aiKeys` (base64 of the `safeStorage`-encrypted key per provider), same path as account tokens. The page can save, remove and ask "has key", never read one. Keys are also scrubbed from every error by the service guard, and an HTTP error that echoes the key shows `[key]`. Gemini takes the key in the `x-goog-api-key` header, never `?key=` in the URL.
- **Settings:** provider, model per provider and the compatible base URL are non-secret and stay in renderer storage; each call sends them and main validates them (known provider; model matches `[A-Za-z0-9][\w.:/#@+-]*`, so it can never be a CLI flag; base URL https, or http only for `localhost`, `127.0.0.1`, `[::1]`). Default models: `gpt-5-mini` (OpenAI), `gemini-2.5-flash` (Gemini); the compatible server needs one. Its key is optional (Ollama, LM Studio).
- **CLI flags (checked 2026-11-23):** OpenCode v2.3.2 `opencode run --help` installed here: `run [message]`, `--model provider/model`, `--archived` ("useful for scripted or CI runs"); its source reads the message from stdin when stdin is not a TTY. Codex is not installed here, so its flags come from the docs (learn.chatgpt.com, "Non-interactive mode"): `codex exec` reads the prompt from stdin when the argument is `-`, prints only the final message on stdout, runs read-only by default; GitDeck passes `exec --sandbox read-only --skip-git-repo-check --ephemeral --color never [--model m] -`. `--sandbox read-only`, `--color never`, `--model`, `--ephemeral`, `--skip-git-repo-check` and `-` for stdin also checked in the `openai/codex` source (`codex-rs/exec/src/cli.rs`, `utils/cli`), not against a binary. Both run from the temp folder, not the repository, so the agent only sees the diff it is given. No shell, argument array, prompt on stdin.
- **Test button:** sends a fixed one-line sample diff, no repository data.
- **Not verified:** any real provider (needs keys or sign-ins), the Codex binary, whether `opencode run` prints anything besides the reply on stdout, and the Settings section in a window (no display check was done).

## 2026-11-24: Phase 30 as built (change log)

- **Meaning:** the first build read "change log" as the commits between two repo tags. The user meant GitDeck's own change log per release version. That build was reverted (ab757b3) and replaced.
- **Source:** `CHANGELOG.md` in the repo, bundled into the renderer with Vite `?raw`, so it works offline and needs no network or tags. Backfilled from the tag messages of 0.1.2 to 0.1.6 (0.1.0 and 0.1.1 never produced a release). Release candidates are not written up; the entry is added when the version is promoted.
- **Shown in:** Settings > About, newest first, the newest open and marked installed (a test keeps it equal to `package.json`). No pop-up after an update.
- **Process:** `docs/RELEASING.md` and the `releaser` agent add the entry in the release commit. `tests/changelog.test.ts` checks the top version and that every entry has Fixes, Contents and Known limits.
- **Not verified:** the list in a window (no display check was done). Unreleased work on `develop` is not listed until a release.
- **GitHub notes (hybrid):** the bundled `CHANGELOG.md` stays the offline base. "Check for newer notes" in About calls the GitHub releases list (`fetchReleaseNotes`, main, no token) and shows releases newer than the installed version above the bundled ones, marked "New". Only on that button, never at launch. Release bodies use bare section names ("Fixes"), so `parseChangelog` accepts both forms. Note the GitHub body of 0.1.6 differs a little from its tag message, which the bundled 0.1.6 entry copies.

## 2026-11-24: Phase 31 as built (interactive rebase)

- **Entry point:** a commit's graph menu, "Rebase onto here, interactively". `base` is a commit hash in the current branch's history; branch refs keep the existing non-interactive rebase.
- **Todo path:** main builds the todo from checked full hashes and a fixed action list. It goes to git as a temp file that `GIT_SEQUENCE_EDITOR='cp <file>'` copies over git's todo (git runs it through `sh`; the path is ours and single-quoted). `GIT_EDITOR=true`, so a squash keeps git's combined message. Config `rebase.autoStash` and `rebase.autoSquash` are off for the run.
- **Reword:** emitted as `pick` plus `exec git commit --amend -F <message file>`. The message only ever lives in a file in a `mkdtemp` folder, never in the todo or an argument. The folder is removed after a clean run; after a stop on conflicts it is kept so later rewords still work, and is left to the OS temp cleanup (shortcut).
- **Refused (main, repeated from the renderer):** detached HEAD, another operation or bisect running, dirty tree, a merge commit in range, a base that is not an ancestor of HEAD, over 500 commits, a todo that does not name every commit once, an unknown action, a leading squash or fixup, an empty reword message. Pushed commits (reachable from any `refs/remotes/*`) need the service's own confirm dialog.
- **Stops:** reuse `OperationBanner` and the conflict editor (Continue, Skip, Abort). The dialog has no Abort of its own: it closes as soon as the run starts, and the banner is where a running rebase is aborted. Not "always visible" inside the dialog as the plan said, because there is no running state while it is open.
- **Not done:** `edit` and `break` actions, rebasing merges (`--rebase-merges`), and Windows without Git for Windows' `sh`/`cp`.
- **Not verified:** the dialog and banner in a window (no display check was done).

## 2026-11-24: Phase 32 as built (PR/MR notifications)

- **Polling accepted:** starting the phase settled the open question above. Main polls; nothing is pushed to GitDeck from outside.
- **Setting:** `Project.notify` (event ids), set in Edit project, missing or empty means off. Events: new, merged, closed, reviewer requested, checks failed. A repository in two projects uses the union of their events. `local:` repositories are never polled.
- **"New review" is "reviewer requested":** the user's choice. The PR/MR list has requested reviewers but no submitted reviews, so this needs no extra call. Submitted reviews would need one more request per changed PR/MR.
- **Differ (`src/shared/notify.ts`, pure):** the first load is a baseline. "New" means a number above the highest one seen, so an old request re-entering the 100-item window is not new. Reopened emits nothing.
- **Poller (`src/main/notifyPoller.ts`, no electron):** every 2 minutes (the plan's floor is 60 s; a poll is two list pages per repository), one repository at a time. Checks are read only for open requests whose head changed or whose last state was pending, and the first sighting is a baseline. 429 doubles that repository's delay up to 30 minutes and a success resets it. 401 or 403 stops that repository with one "stopped" notification; saving any project change retries it. Other errors wait for the next tick.
- **"Reuse the Phase 22 cache":** not literally. That cache is per pane in the renderer; the poller keeps its own last list in main and calls the same `listChangeRequests` / `getChecks`, so same-origin pagination and error text are shared.
- **Notification:** Electron `Notification` in main, title `<host> · <owner/repo>`, body `#12 merged: <title>`. No URL, token or diff. A click focuses the window, switches to the project if the current scope lacks the repository, and opens that repository's PR/MR tab. It does not highlight the single request (skipped).
- **Settings > Notifications:** an app-wide switch (`config.json` `notifications`, missing means on, because projects already opt in one by one) and "Send a test notification". Off makes the poller watch nothing, so turning it back on starts from a fresh baseline. The test cannot see a notification the OS blocks: on macOS `Notification.isSupported()` stays true when the user denied permission, so the status text says where to allow it.
- **macOS needs a signed app (found 2026-11-24):** Electron 45's docs say macOS notifications require a code-signed app. A probe with the dev `Electron.app` got `failed: UNErrorDomain error 1` (not allowed) from `show()`, with `isSupported()` true. The test button therefore waits for `show` or `failed` and reports macOS's reason instead of "Sent". The cause in dev is that pnpm's Electron is only _linker_-signed (`flags=adhoc,linker-signed`), so macOS never registers it for notifications. A full ad-hoc re-sign (`codesign --force --deep --sign -`, in the README) fixes it, as it did in the author's other Electron app. The released GitDeck gets a full ad-hoc signature from electron-builder (`identity: '-'`), so it is allowed once the user agrees; confirmed on the packaged 0.2.0-rc.1 (no Electron re-sign needed).
- **Verified by hand (2026-11-24, `pnpm dev` on macOS):** the test notification, the Allow notifications switch (the test button is disabled while off), and real "opened" and "closed" notifications for a GitHub PR (#2 on nitipon-apaisri/git-deck).
- **Verified by hand in the packaged 0.2.0-rc.1 (2026-11-24):** the build itself, the test notification, PR opened and closed notifications, and clicking one to open the Pull requests tab.
- **Not verified:** the merged, reviewer requested and checks failed events against a real host, GitLab notifications, and the Intel (x64) build.

## 2026-11-25: Roadmap 3 (Phases 33 to 37)

Requested by the user; every recommendation below was accepted. Written into `PLAN.md` and the `README.md` progress list. Nothing is built yet.

- **Order:** 33 graph date order, 34 badge and double-click, 35 bell, 36 branch management, 37 notification setup. 33 is smallest; 37 follows 35 so both share one bell icon; 36 goes late because it is the only phase that deletes branches (remote too) and needs a real remote to check (reordered 2026-11-25).
- **Graph order:** `--date-order` replaces `--topo-order` for everyone, no setting. Parents still come after children, so the lane algorithm is unchanged. Reason: with topo order a merged branch's old commits can sit above another branch's newer ones.
- **Badge:** one pill per branch; local and remote at the same commit merge; monitor icon = local, provider logo = remote, with tooltips; check mark = HEAD only; empty circle removed. The exact visuals are the author's guess at what confused the user (no detail given beyond the screenshot); review with `design-qa`.
- **Double-click:** local checks out; remote-only checks out or creates a tracking branch; tags do nothing; dirty tree shows git's error, no auto-stash.
- **Branch management:** one dialog, Local and Remote sections, bulk delete with a per-branch result; current and default branch protected; remote delete confirms with the count.
- **"Update remote branch" means:** push to upstream (sets it when missing) and fast-forward a local branch from its remote without checkout. Fetching one remote's refs and renaming a remote branch were left out (fetch already exists).
- **Bell:** an in-app inbox of the existing Phase 32 PR/MR events, persisted, capped at 100, no secrets stored. No new event types.
- **Setup is per project:** `Project.notify` is per project, so the repo-header toggle acts on the owning project (union when a repository is in several). The earlier idea of a per-repository setting was dropped for that reason.
- **Open:** where the bell popover sits and what an item click targets beyond opening the PR/MR tab (assumed: top bar, PR/MR tab).

## 2026-11-25, Phase 34 badge checkout

- **Ahead/behind on the pill:** left out. Pills carry no tracking data (only the branch list does), so showing it needs branch data plumbed into the graph. Revisit with Phase 36.
- **Empty circle:** it is the CI dot with state `none` on the checked-out pill. The pill now draws the dot only for success, failure or pending. The lane graph's HEAD ring is unchanged.
- **"+n":** opens a menu of the remaining pills; picking one checks it out (tags and HEAD are disabled).
- **Design QA leftovers (left as is):** one pill plus "+n" (column width), end truncation of names, `px-1.5` padding, native `title` tooltips and no keyboard route to double-click on the first pill (right-click menu and the "+n" list still work).

## 2026-11-25, GitKraken-style pills (`feat/graph-pills-gitkraken`)

Asked by the user after Phase 34, from two GitKraken screenshots. Settled with the user:

- **Branch, not a phase:** a follow-up on its own branch.
- **Check mark:** the checked-out branch has it again (first icon); a detached HEAD keeps it. This reverses the Phase 34 "HEAD only" line.
- **Solid fill:** only the checked-out branch, in its own kind's colour (`main`, `feature` or `project`) filled solid: background `--ref-<kind>-fg`, text `--ref-head-fg`. Both themes work with existing tokens, so no new colours. A teal `--ref-current-*` pair and plain `--ref-head-*` blue were tried first and dropped: blue read like `main`, and teal made a colour that matches nothing else.
- **"+n":** hover, focus or click opens a card under it listing the other refs as pills; Esc or leaving closes it. It replaces the `Menu`.
- **Checkout:** a single click on a card entry checks it out; the main pill keeps double-click. Tags show in the card but are not clickable (tooltip says why).
- **Size:** pills stay 20px, `ROW_HEIGHT` unchanged, no connector line to the commit node.
- **"+n" card, design-qa fixes:** Tab or Down from the chip moves focus into the card; Up/Down move between entries; Tab leaves it; Escape closes from anywhere and returns focus to the chip; a click outside, a scroll or a resize closes it; a click pins it open (hover-away no longer closes it, a second click does); the card flips above the chip or is pulled in at the window edge; tags use `aria-disabled` so they stay focusable with their tooltip.
- **Design-qa points left as they are:** one pill plus "+n" (column width), hand-rolled card instead of a shadcn Popover, `rounded-lg`/`z-50` literals, `hover:brightness-110`, `px-1.5` against `RefBadge`'s `px-2`, standalone `RefBadge` still only bolds `current`. None of this is run in the app; the keyboard flow is untested beyond typecheck and lint.

## 2026-11-25, Phase 38 git activity UI

Asked by the user ("better UI/UX for the git processing section"). Settled with the user:

- **Scope:** the busy and progress feedback while git runs, and the stopped-operation banners. Inside each `RepoPane` (Split View keeps two independent states), tokens only.
- **One indicator:** replaces the early return that hid the whole action row during clone, pull and push, plus the lone fetch and branch spinner. Buttons stay in place and disabled, with a tooltip naming the running write.
- **Confirmation:** a generic text per write ("Push complete"), 4 s, then it fades (no fade with reduced motion). A count such as "Pushed 3 commits" was left out: the hook gets no counts back from main. A declined confirm (force push) or a cancelled folder picker shows nothing. Errors stay until the next write.
- **UI-only rule loosened once:** `OperationState.step` (rebase only) is read in main from `msgnum`/`end` (`rebase-merge`) or `next`/`last` (`rebase-apply`), `null` when unreadable.
- **Cards, not `Island`:** an island is one level only and the banner sits inside the pane's island, so the banner is a plain rounded block with a left stripe in `--warning-text`. Abort and Abort bisect use `variant="danger"`.
- **Left as they are:** dialogs and the conflict editor keep their own busy states. Stash, tags and remotes buttons stay enabled while a write runs (as before).

## 2026-11-25, Phase 39 button activity and toasts

Asked by the user after trying the Phase 38 look ("add those to their own action button and animate the icon"). Settled with the user:

- **Reverses part of Phase 38:** the activity pill (`ActivityIndicator`) and its keyframe are gone. Each write button shows its own state in its icon: spinner, green check (4 s), red cross (6 s). Only the icon is coloured; the button stays outlined, and `danger` stays for destructive actions.
- **Toasts:** a small in-house stack at the app level (no new dependency), newest first, at most 3, stays until dismissed. Every error from a local write goes there, including writes with no button icon (merge, rebase, revert, reset, bisect), so the inline write-error banner is gone. The banner stays for the summary load error.
- **Left inside their dialogs:** the errors of Create and Rename branch, which show beside the field (a toast behind a modal would be worse).
- **Git's live line:** now the tooltip of the running button. One hidden status line announces the label once, not every output line.
- **Known limits:** Clone (HTTPS) and Clone (SSH) both spin, because the hook does not record which one started. A write without a button (merge) shows a toast on failure but no icon.

## 2026-11-26, Phase 40 header overflow menu

Settled with the user:

- **Where:** the buttons live in `LocalActions`, not `RepoHeader`, so the change is there. Tags, Remotes and Unlink moved into a "…" menu (`Menu`, no new component). Unlink is a `danger` entry, hidden for local-account repos as before.
- **Kept visible:** Stash (its count shows at a glance) and, while no folder is linked, Clone and Link existing folder (the primary actions of that state).
- **Not checked:** the row was not run in a window, so the look in Split View's narrow pane is unchecked. Unlink has no confirm step, as before.

## 2026-11-26, Phase 42 git worktrees

- **Identity:** a linked worktree is its own local `Repo` entry (key from the sha1 of its root, the same as "Open folder", so the same folder never appears twice). `Repo.parentKey` is set when the app adds or opens it, and the sidebar nests by it. A worktree opened by hand with "Open folder" has no parent and stays top level. A worktree whose parent entry is gone also stands alone.
- **Why not a worktree list inside the pane:** each entry then gets its own `RepoPane` (graph, changes, scroll, terminal cwd, watcher) with no new pane code.
- **Add:** the folder is picked in main (`ui.pickFolder`), so the renderer never sends an arbitrary path. Open, remove and lock only act on a path that `git worktree list` reports for that repository.
- **Remove:** always confirms. A worktree with changes is refused first; the dialog then offers "Remove anyway" (`--force`), which confirms again. A locked or missing one is disabled (unlock, or prune).
- **Collapse keys:** worktrees use `wt:<parentKey>` and the Unavailable heading uses `\u0000unavailable`, both in `gitdeck.collapsed`.
- **Not checked:** the dialog and the nested rows were not run in a window.

## 2026-11-26, Phase 43 Home profile

Layout follows `docs/ui-boards/HomeProfile.dc.html`.

- **Where Home shows:** a fixed "Home" button above the repo filter. It also shows by itself when "All repositories" has no repository selected (it replaces the "No repository selected" pane) and at startup before any pane is picked. Inside a project the project overview stays the empty state, but the Home button still opens Home. Opening a repo, or switching project, leaves Home.
- **Tabs:** the app has panes, not tabs. Home replaces the panes while it shows, like the project overview does; the pane state (which repo, its inner tab) is kept, so clicking a repo returns to it. A pane's graph and scroll are rebuilt on return, as they are after the project overview.
- **"Home section follows `gitdeck.collapsed`":** read as the Home page sections (repositories, activity). Their keys are `home:repos` and `home:activity`. The sidebar and Home now share `state/collapsed.ts`, which re-reads storage before each toggle so neither screen overwrites the other's keys. The Home button itself is not collapsible.
- **One IPC call:** `profile.get(accountId)`. Main reads with the account's token; nothing is cached. The shown account is stored under `gitdeck.homeAccount`.
- **GitHub:** `/user`, `/user/orgs`, `/users/:login/events` and one GraphQL query (pins and contribution calendar). The GraphQL URL is `api.github.com/graphql`, or `<origin>/api/graphql` on Enterprise. If it fails, the heatmap is dropped and recent repos replace pins. Followers and following come from `/user`.
- **GitLab:** `/user`, `/groups`, `/users/:id/events` and recent projects. GitLab has no calendar in its REST API, so the heatmap is counted from the user's events of the last 365 days, read in 12 date windows of 31 days fetched in parallel (100 per page, 10 pages per window, so only a window busier than 1000 events is undercounted; a single newest-first read of 1000 events covered about 3 weeks for a busy account). It is labelled "Counted from events" and the stat reads "Events, 12 months". Followers and following are hidden when `/user` does not return them.
- **Tokens:** `--heat-1` to `--heat-4` added to `src/renderer/src/tokens.css` for the heatmap. `docs/design-system/tokens.*` were already behind the app's file and were not touched.
- **Not checked:** the screen was not run in a window. The GraphQL query was tested against a mock server only, not against a live GitHub.

## 2026-11-26, Borderless controls

- **Question:** should buttons, badges, text fields, search boxes and selects keep their 1px edge, and how does focus show on a text field now.
- **Decision and why:**
  - No edges on buttons, badges, text fields, search and select. They are filled with `bg-secondary` (`island-raised`) or a token colour. Reads as one flat surface, as the JetBrains look in `docs/design-system/README.md` asks.
  - Text fields and textareas show focus with a 2px `accent-text` outline and no offset. This replaces the earlier tinted border. Other focusable elements keep the 2px `focus-ring` outline.
  - The Fetch, Pull and Push strip is one filled piece. Its dividers use the `card` colour, not a border.
  - Design-system lines that still described an edge on these controls were changed to match the code: `docs/design-system/README.md` (focus, edges, button colour, activity), `components/Button/README.md` (default variant) and `components/Field/README.md` (input edge and focus). Previews (`preview.html`) still draw borders and were not changed.
  - The older "Focus ring on text fields" entry above is kept as history. This entry supersedes its border part.
- **Not verified:** no display here, so the look, the contrast of the fills in both themes and the focus outline were not checked by eye. The `border-strong` 3:1 rule was not re-measured against the new fills.

## 2026-11-27, Phase 44 Repo Overview dashboard

Layout follows `docs/ui-boards/RepoOverview.dc.html` (wide) and `RepoOverviewNarrow.dc.html` (narrow).

- **`marked` as a devDependency:** Vite bundles it into the renderer, so `dependencies` stays `react`, `react-dom` and `node-pty`. No HTML sanitizer library: `lib/markdown.ts` overrides marked's renderer so that raw HTML in a README is dropped (never parsed), links and images are kept only when they are absolute `https:`, relative images become an "Image: alt" placeholder, and a click on a link calls `openExternal`. Only tags marked itself writes can reach the page. The renderer CSP (`img-src https:`, no inline script) is a second line of defence.
- **Raw HTML dropped:** README badges and centred logos written in HTML do not show. Escaping them as text looked broken; parsing them would need a DOM sanitizer.
- **Sources:** README, commit activity and tags come from the linked clone when its folder is still a repository, else from the host API. The README is the top-level `README*` (any case, `.md` preferred, symlinks skipped), capped at 512 KB on both paths. GitHub reads `/readme` (base64) and GitLab the file named by the project's `readme_url` (else `README.md`) from `/repository/files/:path/raw` on the default branch.
- **Local commit counts use HEAD**, the checked-out branch. GitHub's `/stats/commit_activity` counts the default branch, so the two can differ.
- **Host activity:** GitHub's 202 ("computing") is retried once after 2 s, then the card shows a loading state with Try again; a "computing" answer is never cached. GitLab reads `commits?since=` in sequence, 10 pages of 100, and flags the card ("first 1,000 commits") when it hits that cap.
- **Cache:** the three answers are kept in memory in main, per repo and linked path, so switching tabs or panes never refetches and linking a clone reads it at once. Not persisted like the summary: a README can be 512 KB, too much for the JSON store. Each card's retry skips the cache.
- **Header:** the Overview header shows name, visibility, default branch, namespace, description and topics. `RepoHeader` hides its description on the Overview tab only, and there is no second "Open on GitHub" button: the header's globe button does it.
- **Narrow:** under 760px the order is Commits, About, README, Languages, Contributors, and the stats sit above the heatmap, as on the narrow board. The heatmap keeps the full year and scrolls sideways, opening on the latest weeks.
- **Removed:** the eight stat cards (`statItems`), as the plan says. Stars, forks and open issues are no longer shown in the repo pane; open PRs/MRs stay in the project overview and the PR/MR tab, local branch counts in Info.
- **Tags:** About shows the latest 3 tags (`MAX_TAGS`), then "+n" for the rest of the summary's tag count.
- **Heatmap:** the grid, tooltip and legend moved from `HomeProfile` into `ui/Heatmap.tsx`, shared by both screens.

## Squash merge in the branch menu

- **Option, not a rule change:** "Merge into <branch> (squash)" is a third merge entry beside the fast-forward and no-fast-forward ones. The project's own merges to `develop` still use `--no-ff`.
- **Mode:** the `noFf` flag became `MergeMode` (`'ff' | 'no-ff' | 'squash'`) through the IPC, service and `git.merge`.
- **Commit:** `git merge --squash` only stages, so GitDeck commits at once as `🔀 (merge): Squash merge <branch>`. No message dialog. An already-merged branch stops with "Nothing to merge".
- **Conflicts:** a squash leaves no `MERGE_HEAD`, so the operation banner cannot track it. A conflict is undone (`reset --merge`) and reported; the user merges normally to resolve it. Upgrade if users ask to resolve a squash in the app.
- **Menu rules:** separators now fall between Check out / Delete, Push / Fast-forward, the merge and rebase entries, and the commit actions.

## 2026-11-28, Warm, dimmed light theme

- **Why:** the light theme was hard on the eyes. The white islands (#ffffff) and grey window (#e9ebf0) were the brightest surfaces on screen. Warmth alone would not fix it (the proposed #fef3e2 is brighter than the old window), so the surfaces were also lowered a step.
- **Light surfaces:** window #efe0c8, island #f7ebd7, island-raised #f2e3ca, hover #eddcc0, line #e0cba8, border-strong #8c7358, text #2a1a0e, text-muted #5e4a3a. Host tiles, neutral and shadows were warmed to match.
- **Default accent is Orange:** `DEFAULT_ACCENT` is now `orange` and Orange is first in Settings; its values live in `tokens.css`. Light: primary and accent #b5501a, accent-text #9a4414, focus ring #7f360f. Dark keeps the existing Orange preset values (#b4540a, #f0903c). Blue moved to `appearance.css` as an override with its old values, so anyone who picked Blue keeps it. Anyone who never picked an accent now sees orange, in dark too.
- **Re-tuned for the cream island (light only):** success #288a4e, success-text #17683a, danger #b42318, danger-text #9a1e14, lane-2 and proj-teal #0f8a75, lane-6 and proj-green #288a4e, heat-* follow the orange primary. The tag badge uses amber #f4ae52 at 28% with #6b3f00 text. Refs and the other lanes stay as they were, so history colour is still independent of the accent.
- **Contrast:** 120 pairs checked from the CSS files: text and text-muted on every ground, success/danger/warning/merged text, lanes, ref badges, and all five accents in both themes (white on primary 4.5:1, accent-text 4.5:1 on island, island-raised, hover and selection, accent and focus ring 3:1). All pass. Project icon glyphs on their 20% tile are about 2.3–3.3:1, as they were on white; they are decorative beside the project name.
- **Boards:** the light UI boards were remapped to the new values; the solid blue `main` badge in ChangesLight stays blue (a ref, not the accent). Dark boards still show the Blue accent.
- **Not verified:** no display here, so the new light theme was not looked at in the running app.

## Dark palette follows the accent

In dark theme the ref pills (`--ref-main-*`, `--ref-head-*`) and the heatmap (`--heat-*`) use `var(--accent)`, and `--lane-1` (the mainline) too, so they follow the chosen accent. The other lanes and `--proj-*` are re-tuned to muted cool tones that stay clear of orange. Semantic green and red are unchanged. The light theme is untouched. Not checked visually: there is no display here, so the new lane hues need one look in the running app.

The light theme keeps its blue `--lane-1`, `--ref-head-bg` and `--ref-main-*` on purpose for now: this change is dark only. The commit message box uses the `--island` fill with no resting edge, because `--line` is decorative and must not be the sole edge of an input.

## Dark theme is blue again

Dark goes back to the original blue palette (accent, pills, lanes, project colours, heatmap), restored from `origin/develop`. Light keeps the warm orange. With no saved accent the theme picks the default: blue in dark, orange in light (`defaultAccent` in `lib/accent.ts`; `data-accent` is left off until someone chooses one). Every accent now has explicit dark and light rules in `appearance.css`. Choosing Orange in dark brings back the orange-with-blue-pills mix. Not checked visually: there is no display here.
