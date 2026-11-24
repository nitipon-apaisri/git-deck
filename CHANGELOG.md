# Change log

What changed in each GitDeck release, newest first. The app shows this file in Settings > About. `docs/RELEASING.md` says how an entry is added: one `## X.Y.Z` heading per release, with the sections Fixes, Contents and Known limits.

## 0.2.0

### Fixes

- None. No fixes to 0.1.6 features; fixes made while building the new features are part of them.

### Contents

- Discard chosen lines of a file from the diff, not only the whole file (phase 27).
- Create a pull request or merge request from GitDeck, with an option to push the branch first (phase 28). GitLab now asks for the `api` token scope to create merge requests.
- More AI providers for commit messages: OpenAI, Gemini, any OpenAI-compatible server (such as Ollama), and the Codex and OpenCode command-line tools (phase 29). Keys are kept encrypted.
- GitDeck's own change log in Settings > About, with a button to check GitHub for newer release notes (phase 30).
- Interactive rebase from a commit's graph menu: reorder, drop, squash, fixup and reword commits (phase 31).
- PR/MR notifications per project (new, merged, closed, reviewer requested, checks failed), checked every 2 minutes while GitDeck is open, with an Allow notifications switch and a test button in Settings > Notifications (phase 32).

### Known limits

- Not notarised (no Apple Developer ID): macOS still asks to confirm the first launch.
- The x64 build is cross-built on an arm64 runner and has not been run on an Intel Mac.
- The update check is manual only (Settings, About).
- Notifications are polled, so they can arrive up to 2 minutes late.
- Not checked by hand: the Merged, Reviewer requested and Checks failed notification types, and notifications for GitLab.
- Interactive rebase has no edit or break actions and does not rebase merge commits.
- The new AI providers have not been tried with live keys.

## 0.1.6

### Fixes

- None. No bug fixes since 0.1.5.

### Contents

- Add the develop/stage/main release workflow (phase 26): rc tags on stage, releases on main, slash commands and the releaser subagent.
- Plan Phase 26 and renumber the roadmap (docs only).
- Promote 0.1.6-rc.1 to 0.1.6; no app code changes since 0.1.5.

### Known limits

- Not notarised (no Apple Developer ID): macOS still asks to confirm the first launch.
- The x64 build is cross-built on an arm64 runner and has not been run on an Intel Mac.
- The update check is manual only (Settings, About).
- The quarantined-download behaviour of the ad-hoc build should be confirmed by downloading in a browser.

## 0.1.5

### Fixes

- The Open on web button in the repo header uses a globe icon.

### Contents

- Pull requests and merge requests: status filter tabs and coloured status badges.
- Tags dialog refined: a Push icon and a per-tag menu with danger deletes, a tag filter, a "push after create" checkbox, and long tag messages clamped with an expand/collapse View more control.
- Docs: the Phases 26 to 31 roadmap plan (no app change).

### Known limits

- Not notarised (no Apple Developer ID): macOS still asks to confirm the first launch.
- The x64 build is cross-built on an arm64 runner and has not been run on an Intel Mac.
- The update check is manual only (Settings, About).
- The new UI (status tabs, Tags dialog) was covered by typecheck and the unit tests only; it was not checked visually for this release.
- The release workflow is proven only by a real run.

## 0.1.4

### Fixes

- Terminal: the chmod of the node-pty spawn-helper now targets app.asar.unpacked, to fix "posix_spawnp failed" in the packaged app. This fix has not been run in a packaged build yet.

### Contents

- README: Gatekeeper install steps, node-pty noted as a runtime dependency, and the phase 11-25 features added to the feature list.
- docs/RELEASING.md and the releaser subagent.

### Known limits

- Not notarised (no Apple Developer ID): macOS still asks to confirm the first launch.
- The x64 build is cross-built on an arm64 runner and has never been run on an Intel Mac.
- The update check is manual only (Settings, About).

## 0.1.3

### Fixes

- Opening the downloaded app no longer says "GitDeck is damaged": the macOS builds are now ad-hoc signed. You still get the normal "unidentified developer" prompt: right-click the app and choose Open, or run `xattr -dr com.apple.quarantine /Applications/GitDeck.app`.
- Git hooks and the integrated terminal now find pnpm and node when the app is started from Finder or the Dock. The login-shell PATH fix in 0.1.0 to 0.1.2 never applied; it is fixed and tested against a real login shell.
- Release builds do not publish through electron-builder and use one macos-15 job for both architectures (from 0.1.2).

### Contents

- Commit graph, Changes panel, diff and conflict editor, stash, tags, remotes.
- Integrated terminal per pane; AI commit message via the Claude Code CLI.
- GitHub, GitLab.com and self-hosted GitLab; read-only PR/MR and CI status.
- Projects, Split View, command palette, file history and blame, bisect.
- macOS DMG and zip for arm64 and x64; manual update check in Settings > About.

### Known limits

- Not notarised (no Apple Developer ID): macOS still asks to confirm the first launch.
- The x64 build is cross-built on an arm64 runner and not run in CI.
- The quarantined-download behaviour of the ad-hoc build is not tested yet.
- Update check is manual only.
- 0.1.2 installs keep the old PATH bug: push from a terminal until you update.

## 0.1.2

### Fixes

- Release builds no longer fail with "GitHub Personal Access Token is not set": electron-builder runs with --publish never and the workflow uploads the files.
- The release workflow uses one macos-15 job that builds both arm64 and x64.
- Hooks and the terminal find pnpm and node when the app is started from Finder (login shell PATH).

### Contents

- First published build: commit graph, Changes panel, diff and conflict editor, stash, tags, remotes.
- Integrated terminal per pane; AI commit message via the Claude Code CLI.
- GitHub, GitLab.com and self-hosted GitLab; read-only PR/MR and CI status.
- Projects, Split View, command palette, file history and blame, bisect.
- macOS DMG and zip for arm64 and x64; manual update check in Settings > About.

### Known limits

- Builds are unsigned and not notarised: macOS Gatekeeper will warn on first open.
- The x64 build is cross-built on an arm64 runner and not run in CI.
- Update check is manual only.
- v0.1.0 and v0.1.1 were tagged but never produced a release; use v0.1.2.
