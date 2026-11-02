---
"@kud/gh-workflow": patch
"@kud/gh-ink": patch
---

Sides can now fold into their bands, so a tab split into Mine and Others needs one heading level instead of two. A stage tab used to stack three headings before its first row, a side rule, a band stepped in under it and then the repo fence, and on a quiet tab two of them only repeated the tab's own count. `layoutSides` takes a `fold` option that draws each band as `» Mine · Their move (2)`, with the side as a quiet prefix, and draws a heading only where it separates something: always when both sides hold rows, and otherwise only when there are two or more bands and one of them is something for you to do, the rule the board already follows. Sides can also carry host-built groups after their bands (`tail`), so a side holding nothing but those keeps its heading without the host building one by hand. Without `fold`, layouts are unchanged.
