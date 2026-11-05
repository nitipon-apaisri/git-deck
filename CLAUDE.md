# GitDeck

Desktop Git client (Electron + React + TypeScript) for GitHub, GitLab.com and self-hosted GitLab, with a commit graph, Projects and Split View.

## Read first

- `PLAN.md` is the build brief: 10 phases with checkboxes, stack versions, IPC contract and the graph algorithm. Do the phase you are asked to do, run its Verify steps, tick its boxes, then stop.
- `docs/design-system/` is the visual source of truth (tokens, component guidelines, previews). `docs/ui-boards/` has the full-screen designs.

- `AGENTS.md` is the portable copy of these rules. Keep both consistent. `docs/DECISIONS.md` logs ambiguities.

## Rules

- Style with tokens only: `var(--island)`, `var(--text)`, etc. from `tokens.css`. No hex values in components. Theme is `data-theme` on `<html>`.
- Runtime dependencies are `react` and `react-dom` only. Fonts and build tools are devDependencies. No native modules.
- Code that does not need Electron must not import `electron`, so it can run under `tsx` tests.
- Never log or store a token outside Electron `safeStorage`. Never put a token in a git config, URL or error message.
- Pane-safe renderer: no global "current repo". Each `RepoPane` owns its tab, summary, graph and scroll state.
- Branch per feature or phase: never commit to `main`. Use `phase/<n>-<slug>`, `feat/<slug>`, `fix/<slug>` or `chore/<slug>` (details in `AGENTS.md`). When a phase is done, also tick it in the `README.md` progress checklist. Merge to `main` with `git merge --no-ff` (never fast-forward), message `🔀 (merge): …`, and only when the user asks.
- Do not push to any remote. Commit locally using gitmoji format `{emoji} ({type}): {message}` (table in `AGENTS.md`).
- pnpm only. Hooks (husky): pre-commit runs lint-staged + gitleaks. Never `--no-verify`; fix the cause or allowlist in `.gitleaks.toml`.
- Node >= 22.12 is required. If there is no display, say plainly what was not checked visually.

## Commands (once Phase 1 is done)

`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`. Available now: `pnpm lint`, `pnpm format:check`.
