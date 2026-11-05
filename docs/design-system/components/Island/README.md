The Island is the panel that holds every working area: sidebar, repo view, each split pane and the project overview.

Fill it with `island`, round it with `radius-xl`, pad it `space-5`, and place it on the `window` ground with a `space-2` gap to its neighbours. In light, add `shadow-island`; in dark, none.

**The consumer provides** the content and the height; an island fills its grid cell and scrolls its own content, never the window.

**Do**
- Keep one level: islands sit on the window, never inside another island.
- Put inputs and stat cards on `island-raised` inside it.

**Don't**
- Don't give an island a border or a heavy shadow.
- Don't stripe rows; use `hover` and `selection` only.
