---
"@kud/gh-ink": patch
---

The row action menu took its width from its action rows alone, so most menus sat on the 40-column floor and the row's title kept about a dozen characters before its ellipsis; one with a commit-type emoji in it wrapped onto a second line, since the emoji draws two cells but was counted as one. The menu now widens to fit the title on one line, up to 88 columns and never past the terminal less its margins, keeping a spare cell for a wide glyph. A title longer than that still truncates at the end, as before.
