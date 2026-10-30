---
"@kud/gh-ink": minor
---

The inbox draws two-level headers. A side with bands beneath it renders as a section rule, a bold label with a rule out to the fence column, and its bands step in under `›`, sitting flush under the side. `c` on a side copies every row in it, header identity follows `id` when one is set, and closing a row no longer drops a side's header while the side still holds rows. Band headers no longer count as tree depth, so the last PR of a band keeps its closing corner. Single-level tabs draw exactly as before. `layoutSides` is re-exported.
