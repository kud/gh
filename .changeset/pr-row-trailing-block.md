---
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

A PR row's thread count, size and age now sit in columns pinned to the right edge instead of running straight on from the title. Before, they started somewhere different on every row, so finding which PR had open threads meant reading each line. Now each column is as wide as the widest value in its section, numbers are right-aligned so the digits line up, and a column no row uses takes no space at all. When a narrow terminal forces a column out, it goes from every row in the section at once, because a gap in one row would read as "nothing here". `trailingColumnsOf` and `sectionShedOf` are exported for any other surface that draws `PrRow`s in a list.
