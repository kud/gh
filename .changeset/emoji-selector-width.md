---
"@kud/gh-ink": patch
---

Titles drop the emoji presentation selector before they are drawn. An emoji like `🏗️` or `♻️` measured two columns but was drawn as one by most terminals, which shifted the rest of its line a column left and broke the frame of any overlay drawn across it.
