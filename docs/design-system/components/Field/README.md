Fields collect text and choices in dialogs; a label sits above a 36px input with the hint below.

Set the label in `body-strong`, the input on `island-raised` with a 1px `border-strong` edge and `radius-md`, and hints in `small` `text-muted`. Scopes, paths and URLs inside hints use `hash` (mono). A group of related options (such as the self-signed certificate toggle) sits in a `radius-lg` box on `island-raised` with a `line` edge; its warning uses `warning-text` with the alert icon.

**The consumer provides** the label text, the value and any validation message.

**Do**
- Associate every label with its input.
- Name the scopes or format a token needs under the field.

**Don't**
- Don't use `line` as an input's edge; it fails 3:1.
- Don't rely on color to show an error; add text.
