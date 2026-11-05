# UI boards

Full-screen designs for GitDeck, in dark and light. They are `.dc.html` templates (`sc-for` loops over sample data, `./support.js` runtime not included), so read them as HTML and CSS reference rather than opening them directly. For something you can open in a browser, use `../design-system/components/*/preview.html` (open them through any static server so `tokens.css` is not needed; they expect the host page to load `../../tokens.css`).

| Board | File (dark / light) |
|---|---|
| Main window: sidebar, graph, commit detail | `Main.dc.html` / `MainLight.dc.html` |
| Split View: two repos, divider | `Split.dc.html` / `SplitLight.dc.html` |
| Project overview | `Project.dc.html` / `ProjectLight.dc.html` |
| New or edit project dialog | `ProjectDialog.dc.html` / `ProjectDialogLight.dc.html` |
| Connect account dialog | `AccountDialog.dc.html` / `AccountDialogLight.dc.html` |

`canvas.json` records the board sizes: windows are 1440 x 900, dialogs 560 x 740 and 520 x 680.
