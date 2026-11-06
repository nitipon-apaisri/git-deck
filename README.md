# GitDeck

A desktop Git client for GitHub, GitLab.com and self-hosted GitLab. Browse every repository you can reach, read its commit graph, group repositories from different hosts into Projects, and put two repositories side by side.

Beyond reading, GitDeck stages, commits, switches branches, pushes and pulls, stashes, cherry-picks and merges. Tags, revert, reset, remotes, non-interactive rebase and hunk staging are in. Staging single lines is planned as Phase 16. Merge conflicts can be resolved inside the app, region by region (see [Known limits](#known-limits-and-roadmap)).

Built with Electron, React and TypeScript.

## Features

- **Host integrations.** GitHub.com, GitHub Enterprise, GitLab.com and self-hosted GitLab, with any number of accounts. Repositories are grouped by host, then namespace, with search.
- **Repository overview.** Commits, contributors, branches, tags, open pull or merge requests, languages and top contributors. Saved data shows first and refreshes in the background. If a refresh fails, the saved data stays and a banner offers Retry.
- **Open a folder.** Open any local Git repository without an account. It appears under Local with its graph and folder info.
- **Local clones.** Clone over HTTPS or SSH, or link an existing folder. Fetch, open the folder, and read local branch, ahead/behind and working tree state.
- **Commit graph.** A lane graph of the whole history, loaded 500 commits at a time and virtualised, so a repository with thousands of commits stays smooth. Select a commit to see its message and changed files.
- **History operations.** Tags (create, annotate, push, delete here or on the remote), revert, reset (soft, mixed or hard, with a confirm for hard) and remotes (add, rename, remove). Non-interactive rebase onto a branch or commit, and staging one hunk at a time from the diff. Revert and rebase reuse the conflict banner, and a rebase can skip the commit it stopped on. URLs never carry a token.
- **Projects.** A named group of repositories from any host or account, with its own icon and colour. A project has an overview page with totals, a sortable table of its repositories, and "Fetch all linked".
- **Split View.** Two repositories at once, side by side or stacked, each with its own tab, graph and scroll position, and a draggable divider.
- **Appearance.** Light, dark or system theme, five accent colours and a choice of font, in Settings. Accounts are connected there too.

## Requirements

- Node.js 22.12 or newer.
- `git` on your `PATH`. GitDeck runs the real `git` for clones, fetches and the graph.
- [pnpm](https://pnpm.io). Other package managers are not supported.
- For tokens to be stored: an OS keychain that Electron can use (macOS Keychain, Windows DPAPI, or a Linux secret service). See [Security model](#security-model).

## Getting started

```sh
pnpm install
pnpm dev        # run the app with hot reload
pnpm build      # production build into out/
pnpm test       # unit and integration tests (node:test through tsx)
pnpm typecheck  # TypeScript, main and renderer
pnpm lint       # ESLint
```

`pnpm format` runs Prettier. A pre-commit hook runs lint-staged and a secret scan (gitleaks).

## Connecting an account

Open **Accounts**, pick a host, paste a token, press **Test connection**, then **Add account**. GitDeck only ever sends the token to that host.

| Host   | Token                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub | A classic token with the `repo` scope, or a fine-grained token with read access to **Metadata** and **Contents** (read and write **Contents** to push). |
| GitLab | A personal access token with the `read_api` and `read_repository` scopes (add `write_repository` to push).                                              |

Cloning a private repository over HTTPS uses the same token. For SSH, GitDeck uses whatever your own `ssh` setup already does.

### Self-hosted hosts

- Choose **GitLab self-hosted** or **GitHub Enterprise** and type the base URL, for example `https://git.example.com`. A path prefix such as `https://example.com/gitlab` works. A missing `https://` is added.
- Internal certificate authorities work without any setting, because GitDeck uses the operating system's certificate store.
- A host with a self-signed certificate needs the **Allow self-signed certificate for this host** option. It is per host, never global, and it also applies to the `git` commands for that host.

## Keyboard shortcuts

`Mod` is Ctrl on Windows and Linux, Cmd on macOS.

| Shortcut                  | What it does                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| `Mod+K`                   | Focus the sidebar filter. Opens the sidebar first if it is closed. |
| `Esc` in the filter       | Clear the filter. A second press leaves the field.                 |
| `Mod+Alt+S`               | Turn Split View on or off.                                         |
| `Mod+1`, `Mod+2`          | Focus pane 1 or pane 2 (Split View).                               |
| `Up`, `Down`              | In the graph: select the previous or next commit.                  |
| `PageUp`, `PageDown`      | In the graph: move by a page of commits.                           |
| `Home`, `End`             | In the graph: first or last loaded commit.                         |
| `Esc` in the graph        | Close the commit details.                                          |
| Arrow keys on the divider | Move the Split View divider by 2%. Double-click it to centre it.   |
| Arrow keys in a menu      | Move between items. `Enter` or `Space` chooses, `Esc` closes.      |
| `Esc` in a dialog         | Close the dialog.                                                  |

`Mod+K` is ignored while a dialog is open, so it never steals a keystroke from a form.

## Projects

1. Open the scope switcher at the top of the sidebar and choose **New project…**, or right-click a repository (or use its `…` button) and choose **New project…**.
2. Give it a name (1 to 60 characters, unique ignoring case), an icon (built in, or one emoji) and a colour, and tick the repositories.
3. Choose the project in the scope switcher. The sidebar then shows only its repositories, still grouped by host and namespace. Repositories that no loaded list has any more (access lost, account removed) wait in an **Unavailable** group with a remove button.
4. **Project overview** shows totals and a table. Commits and open requests are sums over the repositories that reported a value. Contributors are merged across the top 25 of each repository and are approximate (`~`). A **Partial** badge means some counts are missing.

Deleting a project never touches the repositories or your local clones. Removing an account removes its repositories from every project.

## Architecture

```
src/main       Electron main process. Owns every side effect: window, IPC, store, http, tls, git, providers.
src/preload    contextBridge: exposes window.api, nothing else.
src/renderer   React UI. Talks to main only through window.api.
src/shared     Domain types, the IPC contract and pure code (graph layout, project helpers). No electron import.
tests          node:test through tsx.
docs           Design system, UI boards, DECISIONS.md.
```

- **Main** holds the accounts, the encrypted tokens, the caches and the project list in the user data folder (`config.json`, `cache.json`, written atomically). Providers (`GitHubProvider`, `GitLabProvider`) turn an account and a token into repositories and summaries. `git.ts` runs `git` and parses its output.
- **The renderer sends keys, not locations.** It names a repository by its key (`accountId:remoteId`) and a project by its id. Main looks the repository up in its own cache, and only runs git in folders that are linked to a repository. The one URL it can pass is a web link to open in your browser, and main refuses anything but `http` and `https`.
- **Pure code is kept apart from Electron.** Anything that does not need Electron does not import it, so it runs under `tsx` in plain tests. The renderer's logic (graph paging, split state, project rows, sorting) is in `renderer/src/lib` as pure functions; React hooks are in `renderer/src/state`.
- **The graph** is laid out by a stateful lane-assignment class (`src/shared/graph-layout.ts`) that accepts pages as they load. Rows are SVG, drawn only for the visible range.
- **Panes are independent.** There is no global "current repository". Each pane owns its tab, summary, graph and scroll, so two can sit side by side.
- **Styling** is CSS Modules with design tokens (`docs/design-system/tokens.css`). Components use `var(--…)` only, never a hex value. The theme is a `data-theme` attribute on `<html>`.
- The only runtime dependencies are `react` and `react-dom`. Fonts and build tools are dev dependencies, and there are no native modules.

`PLAN.md` is the full build brief and `docs/DECISIONS.md` records each call that the brief left open.

## Security model

- **Tokens are encrypted** with Electron `safeStorage` (the OS keychain) before they touch disk, and are decrypted only in the main process to make a request. If secure storage is unavailable, GitDeck refuses to store a token. On Linux, the plaintext `basic_text` fallback counts as unavailable.
- **A token never leaves its host.** It goes in a request header to that account's own host. It is never put in a URL, a log line, an error message, `.git/config` or the arguments of a process.
- **Git gets its credentials from the environment.** For clone and fetch, GitDeck sets a one-off `GIT_CONFIG_*` variable that adds an `Authorization` header for that single origin. Nothing is written to the repository's config, and other hosts get nothing.
- **IPC is a narrow, validated surface.** `window.api` offers fixed functions. Main validates every argument at runtime, and errors go back as plain messages with no stack.
- **The window is locked down.** `contextIsolation` on, `nodeIntegration` off, the renderer sandboxed, a Content Security Policy that forbids inline scripts, and navigation limited to the app itself. Links to web pages open in your browser, and only `http` and `https` ones.
- **TLS is checked by default.** The self-signed option is stored per host and applies to nothing else.
- **A pre-commit secret scan** (gitleaks) runs on every commit.

## Known limits and roadmap

Known limits:

- GitDeck was developed and checked on macOS, against mock GitHub Enterprise and GitLab servers. It has not been run against github.com or gitlab.com, or on Windows or Linux.
- A repository's summary can take a moment on a large repository: counts come from several API calls, and a host that rate-limits you may return partial counts. Partial totals are marked as such.
- Only the first 25 contributors of each repository are read, so contributor totals are approximate.
- The sidebar list and the project form's repository list are not virtualised. An account with many thousands of repositories will feel slow there. The filter helps.
- Split View has two panes at most.
- The graph shows the history that `git log` reports for the linked folder. Detached HEAD and graphs with more than about ten lanes at once were not checked.

Not planned for this version: interactive rebase, line-level discard, a full-file three-way editor, creating pull or merge requests, OAuth sign-in (tokens only), a SQLite cache, auto-update and installers, more than two panes, drag-and-drop between projects, and cloning every repository of a project at once.

### Packaging later

There is no installer yet. The usual route is [electron-builder](https://www.electron.build): add it as a dev dependency, set `build` options (app id, icons, targets) in `package.json` or an `electron-builder.yml`, and run it after `pnpm build`. Signing and notarising need your own certificates. Because GitDeck has no native modules, no per-platform rebuild step is needed.

## Progress

Tick a phase here when its PLAN.md checkboxes are done and its branch is merged.

- [x] Phase 1: Scaffold
- [x] Phase 2: Core services (no UI yet)
- [x] Phase 3: Providers
- [x] Phase 4: IPC and main wiring
- [x] Phase 5: Renderer: shell, accounts, sidebar
- [x] Phase 6: Renderer: repo view, overview, info
- [x] Phase 7: Commit graph
- [x] Phase 8: Split View (two repos at once)
- [x] Phase 9: Projects
- [x] Phase 10: Polish and docs
- [x] Phase 11: Changes, diff, stage, commit
- [x] Phase 12: Branches, checkout, push and pull
- [x] Phase 13: Stash, cherry-pick, merge
- [x] Phase 14a: Tags, revert, reset, remotes
- [x] Phase 14b: Rebase and hunk staging
- [x] Phase 15a: Conflict data and whole-file resolution
- [x] Phase 15b: Conflict editor screen
- [ ] Phase 16: Line-level staging
