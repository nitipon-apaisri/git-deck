---
description: Release a tested rc from stage to main, tag it, merge back into develop and stage. Local only.
argument-hint: <X.Y.Z>
---

Release `$ARGUMENTS`. Follow "Release" in `docs/RELEASING.md`; use the `releaser` subagent.

Refuse, say why and stop (change nothing) when:

- `$ARGUMENTS` is not `X.Y.Z`, or the tree is not clean.
- `stage` is not at a `vX.Y.Z-rc.N` tag (`git describe --exact-match --tags stage`), or that rc tag is not on the remote.
- `develop` has commits `stage` lacks (`git rev-list stage..develop`): stage is behind. Say so; do not merge for the user.
- `vX.Y.Z` already exists locally or on the remote.

Then: write the notes file (Fixes, Contents, Known limits). On `chore/release-X.Y.Z` from `stage`: set `package.json` version to `X.Y.Z`, commit `🔖 (release): X.Y.Z`. `git merge --no-ff` it into `main` (`🔀 (merge): release X.Y.Z`), tag `vX.Y.Z` with `-a -F`. Then merge `main` into `stage` and into `develop` with `--no-ff` (`🔀 (merge): sync main X.Y.Z`) so the bump is not lost. Never push. Hand over `git push origin main stage develop && git push origin vX.Y.Z`.
