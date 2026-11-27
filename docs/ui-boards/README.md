# UI boards

Full-screen designs for GitDeck, in dark and light. They are `.dc.html` templates (`sc-for` loops over sample data, `./support.js` runtime not included), so read them as HTML and CSS reference rather than opening them directly. For something you can open in a browser, use `../design-system/components/*/preview.html` (open them through any static server so `tokens.css` is not needed; they expect the host page to load `../../tokens.css`).

| Board | File (dark / light) |
|---|---|
| Main window: sidebar, graph, commit detail | `Main.dc.html` / `MainLight.dc.html` |
| Split View: two repos, divider | `Split.dc.html` / `SplitLight.dc.html` |
| Project overview | `Project.dc.html` / `ProjectLight.dc.html` |
| New or edit project dialog | `ProjectDialog.dc.html` / `ProjectDialogLight.dc.html` |
| Connect account dialog | `AccountDialog.dc.html` / `AccountDialogLight.dc.html` |
| Changes panel and diff, with per-line staging | `Changes.dc.html` / `ChangesLight.dc.html` |
| Conflict editor dialog | `Conflict.dc.html` / `ConflictLight.dc.html` |
| Home profile: account switcher, contributions, pinned repos, activity | `HomeProfile.dc.html` / `HomeProfileLight.dc.html` |
| Repo overview dashboard: commits heatmap, README, about, languages, contributors (dark only; wide pane and narrow Split View pane) | `RepoOverview.dc.html` / `RepoOverviewNarrow.dc.html` |
| App icon ("Sun") with size check, and the eight palette combinations tried | `Logo.dc.html` / `LogoCombinations.dc.html` |

`canvas.json` records the board sizes: windows are 1440 x 900, dialogs 560 x 740 and 520 x 680. The Changes and Conflict boards are static (no `sc-for`) and 1440 x 900, so they open in a browser as they are. The Home profile boards are 1440 x 900 and interactive (account tabs, opening a repo, back to Home). The Repo overview boards are 1120 x 1080 (wide) and 520 x 1720 (narrow), dark only, with a generated commit heatmap (`sc-for`).

The app icon boards are static (1280 x 860 and 1280 x 960). The chosen icon is "Sun": a stack of three flat cards on a yellow ground, palette `#FFC85C` (ground), `#FF653F` (back), `#3730AA` (middle), `#16115E` (front). The packaged icons are `../../build/icon.{svg,png,icns,ico}`; `icon.svg` is the source, drawn on the macOS 1024 grid (824 tile, 100 margin, drop shadow).
