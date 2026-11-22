# Releasing GitDeck

Branches: `main` is released code only, `develop` is where features and fixes land, `stage` is the release candidate (frozen while tested). Slash commands `/stage`, `/release` and `/hotfix` (`.claude/commands/`) run the flows below. A release is a `vX.Y.Z` tag on `main`; a candidate is a `vX.Y.Z-rc.N` tag on `stage`. Pushing a tag runs `.github/workflows/release.yml`: one `macos-15` job builds the arm64 and x64 dmg and zip and attaches them to a GitHub release (`-rc.` tags become a pre-release, which the in-app update check never offers). The `releaser` subagent (`.claude/agents/releaser.md`) follows this file.

## Flow (local, up to the tag)

1. Start from a clean `main`. Run `pnpm typecheck` and `pnpm test`.
2. Write one notes file with three sections: **Fixes**, **Contents**, **Known limits**. The commit, the merge and the tag all use it, so the same text appears everywhere.
3. `git switch -c chore/release-X.Y.Z`, change `"version"` in `package.json`, commit `🔖 (release): X.Y.Z` with the notes as the body.
4. `git switch main && git merge --no-ff chore/release-X.Y.Z`, message `🔀 (merge): release X.Y.Z` with the same notes.
5. `git tag -a vX.Y.Z -F <notes file>` on the merge commit. Check that `git rev-parse 'vX.Y.Z^{commit}' HEAD` prints the same hash twice.
6. End every commit with the attribution line the session gives. Never `--no-verify`.

## Rules

- **Never commit to `main`, `stage` or `develop` directly**; merges only. A `-rc` tag that is pushed is never reused either: the next candidate is `-rc.N+1`.
- **Never reuse or move a pushed tag.** A tag-triggered run uses the workflow file from the tagged commit, so a workflow fix needs a new version. Check first: `git ls-remote --tags origin vX.Y.Z`. A tag that exists only locally can be deleted and recreated.
- **The user pushes.** `.claude/settings.json` denies `Bash(git push*)` and `CLAUDE.md` says never push. Hand over `git push origin main && git push origin vX.Y.Z` (or the `/release` push line above). Deleting a remote tag is also theirs: `git push origin :refs/tags/vX.Y.Z`.
- **Push from a terminal**, not from a GitDeck build older than 0.1.3: older builds had no login `PATH`, so the husky hook failed with `pnpm: command not found`.
- Pasting terminal output into a prompt runs it as commands and leaves empty files (`gitdeck@X.Y.Z`, `gitleaks`). Delete them; they are untracked.

## Checking the run

1. `git ls-remote --tags origin vX.Y.Z`. No tag means no run yet; do not report on an older run.
2. `gh run list --workflow=Release --limit 3`, then `gh run view <id> --json status,conclusion,jobs`.
3. Wait with a background `until [ "$(gh run view <id> --json status --jq .status)" = completed ]; do sleep 15; done`, not a long `sleep`.
4. Success is the job `success` **and** `gh release view vX.Y.Z --json assets` listing four files: `GitDeck-X.Y.Z.dmg`, `GitDeck-X.Y.Z-arm64.dmg`, `GitDeck-X.Y.Z-mac.zip`, `GitDeck-X.Y.Z-arm64-mac.zip`.
5. The workflow sets no release body. Add it: `gh release edit vX.Y.Z --title "GitDeck X.Y.Z" --notes-file <notes file>`.
6. On failure: `gh run view <id> --log-failed | tail -40`. Report the cause; fix on a branch; release a new version.

## Gotchas (each one cost a release)

| Symptom                                                                                                    | Cause                                                                                       | What the repo does now                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Job cancelled in 1 s: "configuration 'macos-14-arm64-us-default' is not supported"; x64 job queued forever | GitHub retired `macos-14` and `macos-13`                                                    | `macos-15`. Check GitHub's runner changelog before reusing a label                                                                             |
| "GitHub Personal Access Token is not set" after a successful package step                                  | electron-builder publishes implicitly when built on a git tag                               | `package` script has `--publish never`; the workflow uploads with `softprops/action-gh-release`                                                |
| Each matrix job built both architectures                                                                   | `arch: [arm64, x64]` on the targets in `electron-builder.yml` overrides `--arm64` / `--x64` | One job builds both; no matrix                                                                                                                 |
| "GitDeck is damaged and can't be opened" on a browser download                                             | Apple silicon refuses a quarantined app with no signature                                   | `identity: '-'` (ad-hoc) and `hardenedRuntime: false`. Users: right-click, Open, or `xattr -dr com.apple.quarantine /Applications/GitDeck.app` |
| `pnpm: command not found` in a hook run from GitDeck                                                       | A Finder-launched app has a minimal `PATH`                                                  | `src/main/shellPath.ts` loads the login shell `PATH` at start                                                                                  |
| That `PATH` code did nothing in 0.1.0 to 0.1.2                                                             | `"$PATH__MARK__"` is one (empty) variable name in zsh                                       | Use `${PATH}`; the test runs a fake login shell and asserts the value is applied                                                               |
| A `-rc` run published a normal release                                                                     | The workflow decides pre-release from the tag name                                          | `prerelease: ${{ contains(github.ref_name, '-rc.') }}`; the tag must contain `-rc.`                                                            |
| A built app exits at once when your installed GitDeck is open                                              | `requestSingleInstanceLock` in `src/main/index.ts`                                          | Test a build with `--user-data-dir=<tmp dir>`                                                                                                  |

## Known limits to state in every release

- Not notarised (no Apple Developer ID): macOS still asks to confirm the first launch.
- The x64 build is cross-built on an arm64 runner and has not been run on an Intel Mac.
- The update check is manual only (Settings, About).
- The quarantined-download behaviour of the ad-hoc build was not tested before 0.1.3 shipped; confirm it by downloading in a browser.

## Ideas (not built)

- Fill the release body from the tag message in the workflow.
- Developer ID signing and notarisation (needs an Apple account).
- A separate Intel runner (`macos-15-intel`) to test the x64 build.
