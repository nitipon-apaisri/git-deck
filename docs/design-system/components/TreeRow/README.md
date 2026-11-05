The tree row is one line in the sidebar: a host group, a project, or a repository under a host.

Rows are `tree-row-height` (30px) high, `radius-md`, padded 8px, set in `body`. A host row has a chevron, a 20px host tile in `host-github`, `host-gitlab` or `host-selfhosted` with its two-letter label, the host name and a `small` `text-muted` count. A repository row is indented to 30px, leads with a `success` dot when cloned, and ends with its commit count. Hover is `hover`; the selected row is `selection` with weight 500.

**The consumer provides** the host, the repository full name, whether it is cloned and the count (or "Not cloned" / "Unavailable").

**Do**
- Truncate long names with an ellipsis and keep the count visible.
- Show clone state with the dot and the title "Cloned"; the text "Not cloned" carries the other state.

**Don't**
- Don't use more than two levels in the tree.
- Don't color the label; only the tile and dot carry color.
