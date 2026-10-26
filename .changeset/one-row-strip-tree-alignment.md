---
"@kud/gh-ink": minor
---

The status strip is a single row. The `success` row is gone: a busy row now ends with a quiet `✓ N fine` before the age, and a calm one reads `✓ all N fine`. The count's width is reserved first, so a narrow terminal drops problem items, never the total. Item names are regular weight, because some terminals repaint bold default-foreground text in a custom colour and the names turned into a state of their own.

In the board tree, the focus mark `⌖` now sits beside the cursor, ahead of the tree, and the ticket-only `┬ ` opener is gone. A child ticket's key lines up with its PR siblings' numbers, and each `─` reaches its row.
