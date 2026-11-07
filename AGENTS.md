# GitDeck: agent instructions

Portable instructions for any coding agent. `PLAN.md` is the build brief. `CLAUDE.md` holds the Claude Code working rules. This file must stay consistent with it.

Desktop Git client (Electron + React + TypeScript) for GitHub, GitLab.com and self-hosted GitLab, with a commit graph, Projects and Split View.

**Package manager: pnpm only.** Never commit `package-lock.json` or `yarn.lock`. Node >= 22.12.

## Read first

- `PLAN.md`: 10 phases with checkboxes, stack versions, IPC contract, graph algorithm.
- `docs/design-system/`: visual source of truth (tokens, component guidelines, previews).
- `docs/ui-boards/`: full-screen designs.
- `docs/DECISIONS.md`: log of ambiguities and the call made.

## Workflow

- Do the phase you are asked to do, run its **Verify** steps, tick its boxes in `PLAN.md`, then stop.
- Keep dependencies minimal. The packaged app has no runtime dependencies beyond what Vite bundles: `package.json` `dependencies` stays `react`, `react-dom` and `node-pty` (the one native module, for the integrated terminal, see `docs/DECISIONS.md`, Phase 19). UI libraries (shadcn's Radix, Tailwind, `class-variance-authority`, `clsx`, `tailwind-merge`, `@xterm/xterm`), fonts and build tools are devDependencies. No other native modules.
- If something is ambiguous, pick the default from `PLAN.md` and record it in `docs/DECISIONS.md`.
- If there is no display, say plainly what was not checked visually.

## Folder structure

| Path               | Role                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/main`         | Electron main process: window, IPC handlers, store, http, tls, git, providers. Owns all side effects. |
| `src/preload`      | `contextBridge` exposing `window.api`.                                                                |
| `src/renderer/src` | React UI. Only talks to main through `window.api`.                                                    |
| `src/shared`       | Domain types, IPC contract, pure graph layout. No `electron` import.                                  |
| `tests/`           | `node:test` via `tsx`, mirroring `src/`.                                                              |
| `docs/`            | Design system, UI boards, `DECISIONS.md`.                                                             |

## Branches

- Never commit directly to `main`. Create a new branch from `main` for every feature or phase before making changes.
- Names: `phase/<n>-<slug>` for a PLAN.md phase (for example `phase/1-scaffold`), `feat/<slug>` for a feature, `fix/<slug>` for a bug fix, `chore/<slug>` for tooling or docs.
- Finish a branch by running its Verify steps, ticking the PLAN.md boxes and the `README.md` progress checklist, then stop. Merging to `main` is the user's call. Never push.
- Merge with `git merge --no-ff <branch>`, never fast-forward, so every phase or feature shows as one merge commit and `git log --first-parent` reads as one line per branch. Message: `🔀 (merge): <what the branch did>`, for example `🔀 (merge): phase 6, repo pane, overview and info`. Run the merge only when the user asks.

## Commits (gitmoji)

Format: `{emoji} ({type}): {imperative, concise message}`. One logical change and one primary emoji per commit. Commit only when asked. Never push to any remote.

| Change           | Prefix                     |
| ---------------- | -------------------------- |
| New feature      | `✨ (feat):`               |
| Bug fix          | `🐛 (bug):`                |
| Performance      | `⚡️ (improve):`            |
| UI / style       | `💄 (ui):`                 |
| Refactor         | `♻️ (refactor):`           |
| Config / tooling | `🔧 (config):`             |
| Dependencies     | `➕` / `➖` / `⬆️ (deps):` |
| Docs             | `📝 (docs):`               |
| Tests            | `✅ (test):`               |
| CI               | `💚 (ci):`                 |
| Lint             | `🚨 (lint):`               |
| Remove           | `🔥 (remove):`             |
| Security         | `🔒 (security):`           |
| Breaking         | `💥 (breaking):`           |
| Hotfix           | `🚑 (hotfix):`             |
| Merge a branch   | `🔀 (merge):`              |

## Code quality

- TypeScript `strict`. No `any` without a comment saying why. Use `import type` for types.
- Small, typed, pure modules. Code that does not need Electron must not import `electron`, so it runs under `tsx` tests.
- Main and `shared` use relative imports. The renderer may use `@shared`.
- Comments explain why, not what.
- **Pane-safe renderer:** no global "current repo", no module-level singletons. Each `RepoPane` owns its tab, summary, graph and scroll state.

## UI rules

- Style with shadcn/ui components and Tailwind classes. Colours come only from the tokens in `tokens.css` (`var(--island)`, `var(--text)` and so on, or the shadcn names mapped onto them in `shadcn.css`). No hex values in components. Theme is `data-theme` on `<html>`.
- Theme is `data-theme` on `<html>`, set before first paint.
- Reuse the components in `src/renderer/src/components/ui/`. Status uses a word or icon as well as colour. Icon-only buttons have `aria-label`.

## Security

- Never log or store a token outside Electron `safeStorage`. Never put a token in a git config, URL or error message.
- Windows use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Validate all IPC input.
- No destructive git operations (force push, `reset --hard`, `clean`, `branch -D`) without asking.

## Git hooks (husky)

- `pre-commit`: `lint-staged` (Prettier + ESLint on staged files), then `gitleaks protect --staged`.
- `pre-push`: `pnpm audit:secrets`. Once Phase 1 lands, also typecheck and tests.
- Install gitleaks with `brew install gitleaks`. `pnpm install` activates the hooks via `prepare`.
- If a hook fails, fix the cause. Never use `--no-verify`. Allowlist real false positives in `.gitleaks.toml` with a reason.

## Verification

Run `pnpm lint`, `pnpm format:check`, and after Phase 1 `pnpm typecheck`, `pnpm test`, `pnpm build`. For UI work, check dark and light when a display exists.

## Scripts

`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test` (added in Phase 1). Available now: `pnpm lint`, `pnpm format`, `pnpm format:check`, `pnpm audit:secrets`.
