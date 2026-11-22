---
description: Cut a release candidate on stage (merge develop, bump X.Y.Z-rc.N, tag). Local only.
argument-hint: <X.Y.Z>
---

Cut a release candidate for version `$ARGUMENTS`. Follow "Release candidate" in `docs/RELEASING.md`; use the `releaser` subagent.

Refuse, say why and stop (change nothing) when:

- `$ARGUMENTS` is not `X.Y.Z`, the tree is not clean, or `develop` or `stage` does not exist.
- `stage` has commits that `develop` lacks (`git rev-list develop..stage`): say so; do not merge for the user.
- `develop` is not ahead of `stage`, or `pnpm typecheck` or `pnpm test` fails on `develop`.

Then: pick N (1 + the highest local or remote `vX.Y.Z-rc.*` tag, else 1). Stop if `git ls-remote --tags origin vX.Y.Z-rc.N` prints anything. On `stage`: `git merge --no-ff develop` (`🔀 (merge): stage X.Y.Z-rc.N`), set `package.json` version to `X.Y.Z-rc.N`, commit `🔖 (release): X.Y.Z-rc.N`, tag `vX.Y.Z-rc.N` with `-a`. Never push. Hand over `git push origin stage && git push origin vX.Y.Z-rc.N`.
