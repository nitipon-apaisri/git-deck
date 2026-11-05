The project icon is the tile that names a project in the sidebar, the project overview and the project dialog.

A tile is 36px (28px in rows) with `radius-lg` (`radius-md` at 28px), filled with the project color at 20% and carrying a line glyph in the full `proj-blue`, `proj-teal`, `proj-violet`, `proj-amber`, `proj-rose`, `proj-green`, `proj-pink` or `proj-gray`. Glyphs come from the fixed icon grid in the project dialog. The chosen tile in the picker shows a 2px `focus-ring` outline.

**The consumer provides** the glyph id and one of the eight color names, stored on the project as `icon` and `color`.

**Do**
- Pair the tile with the project name; the color never stands in for the name.
- Keep all eight colors available in both themes.

**Don't**
- Don't accept free-form hex colors or uploaded images.
- Don't use the project color for text.
