Dialogs collect a short form over the app: connecting an account, creating or editing a project.

A dialog is an `island` surface with `radius-dialog` and `shadow-dialog`, 520px wide (560px for the project dialog), over a scrim of the `window` color at 60%. The header holds a `subtitle` title, a `body` description in `text-muted` and a close icon button; the footer is separated by a `line` rule and right-aligns Cancel and the one primary action. Test or secondary actions sit left in the footer.

**The consumer provides** the title, the description, the fields and the action labels.

**Do**
- Move focus to the first field on open, trap focus, close on Escape and return focus to the opener.
- Name the primary action after the result ("Add account", "Create project").

**Don't**
- Don't stack dialogs.
- Don't put more than one primary button in the footer.
