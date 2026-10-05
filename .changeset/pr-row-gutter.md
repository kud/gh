---
"@kud/gh-ink": minor
---

`PrRow` takes `gutter={false}` for a host that draws its own cursor. A board that hangs pull requests under its own rows already marks the selected line in a column further left, so the row's `❯` turned up a second time on the same line, after the tree glyphs. With the gutter hidden the row draws no cursor of its own and gives the two columns it would have spent to the title. The default is unchanged.
