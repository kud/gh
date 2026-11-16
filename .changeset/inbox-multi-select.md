---
"@kud/gh-ink": minor
---

Rows in the inbox can now be selected several at a time: shift+↑/↓ sweeps a range from where you started, space toggles one row, and esc clears the lot. While a selection is on screen, `o` opens every selected row in the browser and `c` copies their links one per line, where both used to reach one row per keypress. A selected row shows `●` beside the cursor gutter and a quieter wash, the footer reads `3 selected · o open · c copy`, and the selection belongs to one tab, so switching tabs clears it. The count is what is still on the board: a row a search hides, or a refresh moves away, stops counting and is not acted on. Merge, land and remove-me stay single-row, since each runs a confirm a batch would have to skip. Extensions can opt in with `batch: true` and then receive every selected row in `target.items`.
