# GitDeck

Desktop Git client (Electron + React + TypeScript) for GitHub, GitLab.com and self-hosted GitLab, with a commit graph, Projects and Split View.

## Read first

- `PLAN.md` is the build brief: 10 phases with checkboxes, stack versions, IPC contract and the graph algorithm. Plan first: write the step-by-step plan for the phase and wait for the user's OK before editing code. Then do the phase you are asked to do, run its Verify steps, tick its boxes, then stop.
- `docs/design-system/` is the visual source of truth (tokens, component guidelines, previews). `docs/ui-boards/` has the full-screen designs.

- `AGENTS.md` is the portable copy of these rules. Keep both consistent. `docs/DECISIONS.md` logs ambiguities.
- Releases: follow `docs/RELEASING.md` (the `releaser` subagent does). Commands: `/stage`, `/release`, `/hotfix`.

## Rules

- Style with shadcn/ui components and Tailwind classes. Colours come only from the tokens in `tokens.css` (`var(--island)`, `var(--text)` and so on, or the shadcn names mapped onto them in `shadcn.css`). No hex values in components. Theme is `data-theme` on `<html>`.
- A button's colour matches its action: destructive actions (delete, discard, force) use `<Button variant="danger">` or a `danger` menu entry, never `primary`.
- The packaged app has no runtime dependencies beyond what Vite bundles: `package.json` `dependencies` stays `react`, `react-dom` and `node-pty` (the one native module, for the integrated terminal, see `docs/DECISIONS.md`, Phase 19). UI libraries (shadcn's Radix, Tailwind, `class-variance-authority`, `clsx`, `tailwind-merge`, `@xterm/xterm`), fonts and build tools are devDependencies. No other native modules.
- Code that does not need Electron must not import `electron`, so it can run under `tsx` tests.
- Never log or store a token outside Electron `safeStorage`. Never put a token in a git config, URL or error message.
- Pane-safe renderer: no global "current repo". Each `RepoPane` owns its tab, summary, graph and scroll state.
- Branch per feature or phase, from `develop`: never commit to `main`, `stage` or `develop`. A hotfix branches from `main`. Use `phase/<n>-<slug>`, `feat/<slug>`, `fix/<slug>` or `chore/<slug>` (details in `AGENTS.md`). When a phase is done, also tick it in the `README.md` progress checklist. Merge to `develop` with `git merge --no-ff` (never fast-forward), message `🔀 (merge): …`, and only when the user asks. Keep branches short-lived: start each from the latest `develop` and, when the user asks to merge, merge it before starting the next, so branches do not run in parallel and the graph shows one short loop per branch.
- Keep `README.md` current. Before a branch merges to `develop`, and before `/stage` and `/release`, the README must match the code: Features, Install, Known limits, the Progress checklist and the token-use table (`pnpm usage`, which also updates `docs/token-usage.json`). Run the `doc-writer` subagent ("README sync"), commit its change on the branch as `📝 (docs): sync README`, then merge.
- Do not push to any remote. Commit locally using gitmoji format `{emoji} ({type}): {message}` (table in `AGENTS.md`).
- pnpm only. Hooks (husky): pre-commit runs lint-staged + gitleaks. Never `--no-verify`; fix the cause or allowlist in `.gitleaks.toml`.
- Node >= 22.12 is required. If there is no display, say plainly what was not checked visually.

## Commands (once Phase 1 is done)

`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`. Available now: `pnpm lint`, `pnpm format:check`.
