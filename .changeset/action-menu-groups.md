---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

The row action menu is grouped now instead of one long list: host verbs that act, then opens, checkouts, copies, quiet verbs and the close pair last, with a blank row between groups and the cursor stepping over them. Each row shows its key on the right and, on nerd-font terminals, its glyph on the left; closing rows and their confirmations wear the error tone, and the confirmation starts on Cancel rather than on the destructive verb. Host extensions declare their group and glyph through the new `menuGroup` and `icon` fields, and anything that claims nothing still lands with the quiet verbs. No keys change and no verbs were added or removed — "Close PR + Delete branch" reads "Close PR and delete branch" now, and that is the only rename.
