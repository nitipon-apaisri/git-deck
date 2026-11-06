GitDeck is a desktop Git client for people who work across GitHub, GitLab.com and self-hosted GitLab. The interface follows the JetBrains Islands look: a dark or light **window**, with every working area lifted onto a rounded **island**. Dense, quiet, one blue accent.

## Principles

- **Islands, not boxes.** Every panel (sidebar, repo view, each split pane, dialog) is an `island` with `radius-xl` on the `window` ground. Separate islands with a `space-2` (6px) gap of bare window. Never border an island and never nest an island in an island.
- **Quiet chrome, loud history.** Interface chrome stays neutral. Color is spent on the commit graph (`lane-1` to `lane-6`), ref badges, host tiles and project icons.
- **Two themes, one file.** Every component reads tokens only. Use the `dark` theme by default and switch with `data-theme="light"` on the root. Never hard-code a hex value.
- **Pane-safe.** Anything that shows one repository must work at 360px wide (`pane-min-width`) and must not assume it owns the window.

## Color

- Ground: `window` behind everything, `island` for panels, `island-raised` for inputs and stat cards placed on an island, `hover` for hover fills. Rows are never striped.
- Text: `text` for primary copy, `text-muted` for counts, column headers and hints. Links and ghost buttons use `accent-text`. Do not set text in `accent`; it is for marks only (active tab underline, active rail icon, active pane outline, progress).
- The one `primary` button on a screen is `primary` with `on-primary` text. Every other button is a ghost button with a `line` edge.
- Selection is the `selection` fill under a `text` label. Hover is `hover`. Focus is a solid 2px `focus-ring` outline with a 2px offset on every focusable element; never remove it.
- Edges: `line` for hairline dividers. A control's own edge (text input, checkbox, divider grip) uses `border-strong`, which holds 3:1.
- Status always carries a word or icon: **Cloned** with a `success` dot, **Partial** and **Unavailable** with `warning-text` and the alert icon, deletions with `danger` and a minus sign. Never use red against green alone.
- Hosts: GitHub `host-github` tile with "GH", GitLab `host-gitlab` with "GL", self-hosted GitLab and GitHub Enterprise `host-selfhosted` with "SH" or "GE". The label is `text`.

## Commit graph

- Lane _n_ uses `lane-1` to `lane-6` and repeats after six. Lanes sit `graph-lane-width` (16px) apart, rows are `graph-row-height` (28px). Lines are 2px, nodes are 5px radius discs, and the HEAD node is a ring in `lane-1`.
- Ref badges set in `badge` on `radius-xs`: HEAD `ref-head-*` (solid), local branch `ref-main-*`, feature branch `ref-feature-*`, remote project branch `ref-project-*`, tag `ref-tag-*` with the tag icon. Show at most three badges per row, then "+n".
- Hashes, paths and file names are set in `hash` (mono). Everything else is Inter.

## Type

- Set interface text in `body` (13px). Field labels and selected rows use `body-strong`. Counts, column headers and hints use `small` in `text-muted`.
- Page-level names use `title` (repo) or `title-lg` (project). Dialog titles use `subtitle`. Pane headers and the commit subject use `heading`. Stat values use `stat`.
- Weights are 400, 500 and 600 only. No italics, no all caps, no letter-spacing.

## Spacing, radius and layout

- Spacing steps are `space-1` (4) to `space-6` (24). Rows pad `space-4` horizontally; islands pad `space-5`; dialogs and the project overview pad `space-6`.
- Radius by role: islands and stat cards `radius-xl`; dialogs `radius-dialog`; rail buttons, project tiles and icon-grid buttons `radius-lg`; buttons, inputs, tree rows and icon buttons `radius-md`; host chips `radius-sm`; ref badges `radius-xs`; avatars, dots and pane markers `radius-round`.
- Appearance: `appearance.css` holds the accent presets (`data-accent` on `<html>`) and the font choices (`data-font`). Motion uses `motion-fast` (hover, press), `motion-base` (dialogs, menus) and `ease-out`; reduced motion turns it off.
- Shell: `toolbar-height` 48px on top (on macOS it is also the title bar: the traffic lights sit in its left `titlebar-inset` and the bar drags the window), `rail-width` 40px, `sidebar-width` 300px, tree rows `tree-row-height` 30px. The sidebar can collapse to the rail.
- Split View: two panes side by side, each an island, joined by a `divider-width` (12px) draggable grip in `border-strong`. The active pane has a 1px `accent` outline and a numbered `neutral` marker. Below two times `pane-min-width` the panes stack.
- Shadows only on floating layers: `shadow-menu` for menus and popovers, `shadow-dialog` for dialogs. Resting islands use `shadow-island` (none in dark).

## Projects

- A project is a name, an icon and a color. The icon sits in a `radius-lg` tile filled with the project color at 20% and a glyph in the full `proj-*` color. Offer the eight `proj-*` colors and a grid of glyphs; do not allow free-form hex.
- A repository can belong to several projects. Project aggregates add known counts; if any repository has not been loaded, mark the figure **Partial** instead of guessing.

## Iconography

- Line icons only: 24px viewBox, 1.8px stroke, round caps and joins, `currentColor`. Show them at `icon-size` (18px) in the toolbar, rail and tree and `icon-size-sm` (14px) inside buttons, rows and badges.
- Icons in this system are drawn for GitDeck (folder, branch, tag, commit, search, settings, plus, check, x, alert, external link, split, host glyphs). They are not copied from JetBrains. No emoji, no filled icons.
- Icon-only buttons need an `aria-label`. Hit target is 32px.

## Voice

- Sentence case everywhere: "Connect an account", "Add account", "Test connection". Buttons name the action, not "OK".
- Say what happens and what is stored: "Uses a personal access token, stored encrypted in your OS keychain." Warnings are plain and specific: "Only enable this for hosts you trust. It applies to gitlab.acme.dev only."
- Numbers are exact where known and "Partial" or "Unavailable" where not. Never show a placeholder zero.
- No exclamation marks, no emoji, no marketing copy.

## Logo

No logo was supplied. Set the name "GitDeck" in `heading` weight 600, with a `primary` rounded tile (`radius-md`) behind a white branch glyph where a mark is needed. Replace this when a real mark exists.
