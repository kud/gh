---
"@kud/gh-ink": minor
---

Give task rows the refresh vocabulary GitHub rows already had.

`ItemRow`'s task branch returned before ever reaching the transient rendering,
so a surface built entirely from task rows — `life`, which is Todoist and
Notion — applied a refresh in total silence: the list changed and nothing on
screen admitted it. The diff already computed the marks; only the renderer
dropped them.

A row arriving now coalesces, a row leaving dissolves, and either way it says
NEW / GONE / UPDATED in words. The glyph gets a fixed cell of its own, present
even when empty, for the same reason the GitHub row puts it in the health cell:
every key and title on screen is aligned off that column, so a marker that
appeared and vanished would shift the very row being watched.
