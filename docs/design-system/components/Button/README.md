Buttons trigger actions; use one primary button per screen and ghost buttons for everything else.

**Variants**
- Primary: `primary` fill, `on-primary` text, weight 500. The single affirmative action ("Add account").
- Default: transparent with a `line` edge, `text` label. Secondary actions ("Cancel", "Test connection").
- Ghost: no edge, `accent-text` label. Inline actions beside a field ("Create token").
- Icon button: 32px square, `radius-md`, `text-muted` glyph that becomes `text` on `hover`. Needs an `aria-label`.

Size is 34px high, 16px side padding, `radius-md`, `body` type. A leading icon is `icon-size-sm` with a 7px gap.

**The consumer provides** the label (sentence case, names the action) and the handler.

**Do**
- Show focus with a 2px `focus-ring` outline offset by 2px.
- Disable with 45% opacity and keep the label.

**Don't**
- Don't put two primary buttons on one screen.
- Don't write "OK" or "Submit".
