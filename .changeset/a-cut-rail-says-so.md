---
"@kud/gh-ink": patch
---

A rail too short for its roadmap now says how many it could not draw.

`SidePanel` is fixed to the list's height, and Ink's answer to more rows than
height is to cut them without a word. That is the one failure this component
must not have: a roadmap quietly missing its last three initiatives looks exactly
like a roadmap that has none, and an initiative being invisible is the whole
reason the rail exists.

It now keeps one row back whenever anything is left over, and spends that line on
`+N more`. `railCapacity(height, rows)` is exported for a host that needs to
price the rail before rendering it.
