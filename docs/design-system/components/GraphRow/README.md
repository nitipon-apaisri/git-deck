The graph row is one commit in the history list: lane graph on the left, then refs, subject, hash and author.

Rows are `graph-row-height` (28px). The graph column draws lanes `graph-lane-width` (16px) apart in `lane-1` to `lane-6` with 2px lines and 5px nodes; row _i_ centres at y = 14 + 28·_i_. The HEAD commit is a ring in `lane-1` filled with `island`. Merge and fork curves are cubic curves that leave the lane at the row centre. Then come ref badges, the subject in `body` (truncated with an ellipsis), the hash in `hash` `text-muted`, and the author in `small` `text-muted`. The selected commit uses `selection`; hover uses `hover`.

**The consumer provides** the lane and edge data from the pure `graph-layout` module, plus the commit fields. The row itself does no layout.

**Do**
- Keep the graph column at least as wide as the widest lane in the visible window.
- Truncate the subject first; the hash and author stay visible.

**Don't**
- Don't use a lane color for text.
- Don't distinguish branches by lane color alone; the ref badge names them.
