---
"@kud/gh-ink": minor
"@kud/gh-workflow": minor
---

A task row's type pill (`epic`, `story`, `subtask`) now sits in a fixed column ahead of the tree instead of after the summary, where it drifted with every title's length. While any task row in a list carries one, every row reserves the column, PR rows included, so ticket keys and `#n`s still line up; a list without one draws nothing extra. Task rows also gain an optional `stage`, the board column the row sits in, drawn as a quiet grey pill after the summary, beside the note and ahead of any warning.
