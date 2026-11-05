# Decisions

Newest first. Template:

## YYYY-MM-DD: Title

- **Question:**
- **Options considered:**
- **Decision and why:**

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
