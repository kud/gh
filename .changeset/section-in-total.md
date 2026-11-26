---
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

A tab can now stay out of the header's whole-board total. Mark its `Section` with `inTotal: false` and its own badge still counts its rows, but the header's `N items` skips it. This is for a tab whose rows are copies of rows other tabs already hold, such as a short "what only you can do" list built from the stage tabs, which would otherwise count every item twice. `totalCount(sections)` is the header's sum, exported from `@kud/gh-ink` and `@kud/gh-cockpit`.
