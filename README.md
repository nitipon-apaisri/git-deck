# GitDeck

A desktop Git client in the spirit of GitKraken. It connects to GitHub, GitHub Enterprise, GitLab.com and self-hosted GitLab, lists your repositories grouped by host and namespace, shows a summary for each, and renders a commit graph from a local clone.

## Requirements

- Node.js >= 22.12
- `git` on your `PATH`

## Scripts

```sh
npm install        # use ELECTRON_SKIP_BINARY_DOWNLOAD=1 in headless or sandboxed environments
npm run dev        # start the app with hot reload
npm run build      # build main, preload and renderer into out/
npm run typecheck  # both tsconfigs
npm test           # node:test files in tests/, run through tsx
```

## Connecting an account

Open **Accounts** (gear icon in the sidebar), pick a preset, paste a token and press **Add account**. **Test connection** checks the token without saving it, and **Create token** opens the right token page.

| Provider | Token |
|---|---|
| GitHub | Classic token with `repo`, or a fine-grained token with read access to metadata and contents |
| GitLab | `read_api` and `read_repository` |

### Self-hosted notes

- Internal certificate authorities work through the operating system's certificate store.
- For a self-signed certificate, tick **Allow self-signed certificate**. The setting applies to that host only, for both API calls and `git`.
- A base URL with a path prefix (for example `https://example.com/gitlab`) is supported.

## Using it

- Select a repository in the sidebar. **Overview** shows counts, contributors, languages and topics. **Info** shows remote details and, when linked, local details.
- **Clone (HTTPS / SSH)** or **Link existing folder** connects a repository to a local folder. Linked repositories get **Open folder**, **Fetch** and **Unlink**.
- **Graph** shows the commit graph of the linked folder. Click a row for commit details; use the arrow keys to move between rows.
- `Ctrl/Cmd+K` focuses the repository search.

## Architecture

```
src/
  main/       Electron main process: window, IPC, JSON store, providers, git service
  preload/    contextBridge that exposes window.api
  shared/     domain types, IPC contract, graph lane layout (pure)
  renderer/   React UI
tests/        node:test suites
```

- Anything that does not need Electron (`http`, `git`, `store`, providers, graph layout) does not import `electron`, so it is tested in plain Node. Electron's `safeStorage` is injected into the store.
- The UI uses React with shadcn/ui components (Radix UI + Tailwind v4) in `src/renderer/src/components/ui/`. See `DESIGN.md`. State is persisted in `config.json` and `cache.json` under the app's user data folder.
- The renderer shows cached data first and refreshes from the network in the background.
- Git runs through `execFile` without a shell, with `GIT_TERMINAL_PROMPT=0`.

## Security model

- Tokens are encrypted with Electron's `safeStorage`. If encryption is unavailable, GitDeck refuses to store a token.
- Git authentication uses `GIT_CONFIG_COUNT` environment variables with an `http.<origin>/.extraHeader` entry. The token is scoped to one host and never appears in argv, `.git/config` or logs.
- IPC only carries keys and ids. The main process looks up repositories itself, requires every `path` to equal a stored link, and validates commit hashes.
- The window uses `contextIsolation`, `sandbox` and a strict CSP, denies new windows, and blocks navigation away from the app. `openExternal` accepts only http and https URLs.
- Errors shown in the UI are plain messages with token values masked.

## Known limits and roadmap

- Token-based login only (no OAuth).
- Read-only: no staging, committing, diff viewer, merge-conflict UI, rebase, cherry-pick or PR/MR creation.
- JSON-file cache, no database.
- Summary numbers depend on token permissions; anything the API refuses shows as `—`.
- No auto-update or installers.

### Packaging later

Add `electron-builder`, point it at `out/` and `package.json`'s `main`, and run it after `npm run build`.
