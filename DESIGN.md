# GitDeck design system

Minimal, clean, ambient. Floating rounded glass panels over an orange glow: no borders, no shadows, one orange accent and quiet motion. The source of truth is the CSS variables in `src/renderer/src/styles.css`; this file explains how to use them.

## shadcn/ui

Components in `src/renderer/src/components/ui/` follow shadcn/ui (Radix primitives, `cva` variants, `cn()` from `lib/utils.ts`) and are copied source, so edit them freely. Tailwind v4 is loaded in `styles.css`, and `@theme inline` maps shadcn's semantic names onto the tokens below:

| shadcn name | GitDeck token |
|---|---|
| `primary` / `primary-foreground` | `--accent` / `--accent-ink` |
| `accent` / `accent-foreground` | `--accent-soft` / `--accent-strong` |
| `secondary` | `--surface-3` |
| `muted-foreground` | `--muted` |
| `border` / `border-strong` | `--border` / `--border-strong` |
| `ring` | `--accent` |
| `destructive` | `--danger` |

Used so far: Button (`default`, `outline`, `ghost`; sizes `default`, `sm`, `icon`), Input, Badge, Skeleton, Dialog, AlertDialog and Tabs. Layout pieces (sidebar tree, graph, stat cards) stay in hand-written CSS. Root font size stays 16 px so Tailwind's rem scale is normal; the app text size of 13 px is set on `body`.

## Principles

1. **One accent.** Orange `#FF6B35` marks what is active, selected or primary. Everything else is neutral.
2. **Floating panels.** The sidebar and main pane are separate solid white rounded panels (24 px radius, 12 px gap) floating over the orange glow. The glow is the only thing behind them; there are no borders or shadows. Inside the main pane, blocks are tinted (`--surface-2`) rather than white. Dialogs use `--glass-strong` (80 % white) with backdrop blur. `--glass` (10 % white) is kept as a token for any future translucent surface.
3. **Quiet motion.** Transitions are 160 ms ease and only change colour, background or a 1 px press. Reduced motion disables them.
4. **Content first.** Chrome is light, text is dark warm grey, and data (commits, counts) gets the space.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fff8f4` | Window base under the glow |
| `--glass` | `rgba(255,255,255,.10)` | Unused for now; reserved for translucent surfaces |
| `--surface` | `#ffffff` | Sidebar, main pane, inputs, chips |
| `--glass-strong` | `rgba(255,255,255,.80)` | Dialogs |
| `--surface-2` | `rgba(255,107,53,.06)` | Hover rows, commit panel |
| `--surface-3` | `rgba(255,107,53,.12)` | Tracks (progress, language bar), skeleton |
| `--border`, `--border-strong` | `transparent` | Kept only so shadcn classes resolve |
| `--fg` | `#1f1a17` | Primary text |
| `--muted` | `#62574f` | Secondary text |
| `--accent` | `#ff6b35` | Fills, indicators, focus ring, nodes |
| `--accent-strong` | `#c2410c` | Orange **text** (5:1 on white) |
| `--accent-soft` | `rgba(255,107,53,.12)` | Selected and hover backgrounds |
| `--accent-ink` | `#2a1206` | Text on an orange fill (7:1) |
| `--ok` / `--danger` | `#2f855a` / `#c53030` | Additions, deletions, errors |

**Contrast rule:** white on `#ff6b35` is about 3:1 and fails AA. Put dark `--accent-ink` on orange fills, and use `--accent-strong` whenever orange is text on white.

Banners: warn `#fff4d6`/`#7a4d00`, ok `#e8f6ee`/`#216a44`, error `#fdecec`/`#a32020` (background/text).

### Data colours

Graph lanes and the language bar share one palette, orange first:

`#ff6b35 #3d7ea6 #5ba37a #b8860b #9a6fb0 #d6577a #2f9ea0 #8a8f98`

Defined in `GraphRowSvg.tsx` (`GRAPH_COLORS`) and `Overview.tsx` (`LANG_COLORS`). Keep the two in sync. Avatar fallbacks use a soft tint (`hsl(h 70% 90%)`) with dark text (`hsl(h 50% 26%)`).

Ref badges: local branch uses `--accent-soft`/`--accent-strong`, remote `#eef2f6`/`#3f5a73`, tag `#fff4d6`/`#7a4d00`. The current branch is bold.

## Typography

- Font: Inter if installed, then the system UI font. No web font is loaded, because the CSP blocks it and the app should work offline.
- Base size 13 px, line height 1.5. Code and hashes use the system monospace at 12 px.
- Headings are weight 600 with slight negative tracking. Page title 22 px, dialog title 15 px.
- Section labels (`h3`) are 12 px, uppercase, `--muted`, 0.06 em tracking.
- Stat values are 24 px, weight 600.

## Spacing, radius, elevation

- Spacing is a 4 px grid in practice: 4, 6, 8, 10, 12, 14, 18, 24, 28, 32.
- Radius: controls `--radius` (14 px), cards 18 px, panels `--radius-panel` (24 px), dialogs 24 px, pills fully round.
- No borders or shadows. `--border`, `--border-strong`, `--shadow-sm` and `--shadow-lg` are kept as tokens (transparent / none) so shadcn classes still resolve. Focus rings are the only box-shadow allowed, for accessibility.

## Layout

- Two floating white panels on a 12 px gutter: a 300 px sidebar and a flexible main pane, both 24 px radius.
- Background glow: three radial gradients on `.app` (orange 30 % top-right, orange 24 % bottom-left, amber 20 % centre). The glow is what the panels float on, so keep it.
- Repo view: header, tab bar, tab body. The Graph tab fills the remaining height, and the commit panel is 360 px on the right.
- Graph rows are fixed at 28 px and lanes at 16 px (`ROW_HEIGHT`, `LANE_WIDTH`), because the virtualised list depends on them.

## Components

| Component | Notes |
|---|---|
| Button `.btn` | 32 px min height, 50 % white fill, no border. Hover fills with `--accent-soft`. |
| Primary `.btn-primary` | Orange fill, `--accent-ink` text, weight 600. One per view where possible. |
| Icon button `.icon-btn` | Transparent, muted. Hover uses `--accent-soft` and `--accent-strong`. Always needs an `aria-label`. |
| Input | 55 % white fill, no border. Focus: 2 px orange ring. |
| Chip `.chip` | Pill. Active state uses a soft orange fill and `--accent-strong` text. |
| Badge `.badge` | 10 px tinted pill for archived, fork, visibility. |
| Tab `.tab` | Muted text. Active tab is a soft orange pill with `--accent-strong` text. |
| Row `.row` | 8 px radius. Selected repo gets an `--accent-soft` fill. |
| Stat card `.stat` | 50 % white fill, 18 px radius, 24 px value. |
| Banner `.banner` | Icon plus message, with a Retry button for errors. |
| Skeleton `.skeleton` | Warm shimmer, 1.4 s. |
| Dialog `.dialog` | 520 px max, 24 px radius, 80 % white with backdrop blur, warm blurred overlay. Esc and overlay click close it. |
| Dashboard `.dashboard` | Home view when no repo is selected: stat cards, "Needs attention" list of linked repos, then recently opened and recently active. Rows are `.dash-row`; status pills are `.flag-warn`, `.flag-info`, `.flag-error`. |
| Avatar | Image, or initials on a soft tint when missing or broken. |
| Icon | Inline feather-style SVG, 2 px stroke, `currentColor`. No emoji as icons. |

## Interaction and accessibility

- Every clickable element has `cursor: pointer` and a hover state.
- Focus is always visible: 2 px orange outline with a 2 px offset (`:focus-visible`).
- Body text meets 4.5:1. Orange text uses `--accent-strong`.
- Colour is never the only signal: errors have an icon and message, binary files say "binary", the linked dot has a tooltip.
- `prefers-reduced-motion` reduces all animation and transitions to near zero.
- Keyboard: `Ctrl/Cmd+K` focuses search, ↑/↓ move through graph rows, `Esc` closes the dialog or deselects a commit.

## Rules for new UI

1. Use the tokens above. Don't add raw hex values in components, except data colours.
2. Pick one primary action per area. Everything else is a default button.
3. Show loading as a skeleton and failure as a banner with Retry.
4. Keep new motion to colour, opacity or 1 px transforms at 150–250 ms.
5. Check light-theme contrast before adding a new colour pair.

## Not covered yet

- Dark theme (would need a second variable set).
- Moving the remaining hand-written CSS (chips, banners, stat cards) onto shadcn components.
- Bundling Inter locally.
- A visual run of the app: contrast, glow strength and graph palette still need an on-screen check.
