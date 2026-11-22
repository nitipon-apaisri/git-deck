---
description: Start a hotfix branch from main, or finish one (release a patch, sync back). Local only.
argument-hint: <slug> | release <X.Y.Z>
---

Arguments: `$ARGUMENTS`. Follow "Hotfix" in `docs/RELEASING.md`.

**`<slug>`**: refuse unless the tree is clean and `main` exists. `git switch -c fix/<slug> main`. Make the fix there and commit it (use the `committer` subagent). Stop; the user reviews and merges it into `main` with `--no-ff`.

**`release X.Y.Z`**: refuse unless the tree is clean, `main` is the branch, `vX.Y.Z` exists nowhere (local or remote), and the version is a patch above the latest `vA.B.C` on `main`. Release a patch from `main` exactly as the main-only flow in `docs/RELEASING.md` (notes, bump, merge, tag). Then merge `main` into `stage` and into `develop` with `--no-ff` (`🔀 (merge): sync main X.Y.Z`). Never push. Hand over `git push origin main stage develop && git push origin vX.Y.Z`.
