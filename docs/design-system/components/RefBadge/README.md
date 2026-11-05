Ref badges label the branches, remotes and tags that point at a commit in the graph.

A badge is 20px high, `radius-xs`, set in `badge`, with a 1px edge. HEAD is solid (`ref-head-bg` / `ref-head-fg`, no edge). Local and remote default branches use `ref-main-*`, feature branches `ref-feature-*`, remote project or release branches `ref-project-*`, and tags `ref-tag-*` with a 12px tag icon, so a tag is never told apart by color alone.

**The consumer provides** the ref name and its kind.

**Do**
- Order badges HEAD, local branches, remote branches, tags; show at most three, then "+n" in `small` `text-muted`.
- Keep the full ref name; truncate only in the middle with an ellipsis.

**Don't**
- Don't place badges on a lane color; they sit on `island` or the row `selection`.
- Don't add a new kind without a token trio (`-fg`, `-bg`, `-edge`).
