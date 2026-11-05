Stat cards show one summary figure for a repository or a project: repositories, commits, contributors.

A card is `island-raised` with `radius-xl`, padded 12px by 14px. The value is `stat` in `text`; the label is `small` in `text-muted`. A figure that adds only known counts, or an approximate contributor total, carries a **Partial** pill (`warning-bg`, `warning-text`, alert icon) under the label, and an approximate value starts with "~".

**The consumer provides** the value, the label and whether the figure is partial.

**Do**
- Lay cards out in a three-column grid with `space-3` gaps.
- Show "Unavailable" in `text-muted` instead of 0 when a host could not be reached.

**Don't**
- Don't add trend arrows or sparklines.
- Don't color the value.
