---
"@kud/gh-ink": patch
---

Action failures say what went wrong, and cost less to attempt

`✗ Unsubscribe failed` is not a message, it is a shrug — and the first time it
mattered the reason was a spent GraphQL quota, recoverable and twenty minutes
away, which the flash had thrown on the floor. Every action failure now names
the cause and keeps gh's raw line on the end, so an unmapped one stays
diagnosable. The fetch path learned this when `gh: HTTP 502` was landing under
the frame; the actions never did.

Unsubscribe also resolves the node id over REST rather than `gh pr view --json`,
which is GraphQL. It was spending the scarcer of the two budgets twice for one
action — and on the day it first failed, GraphQL was at zero while REST still
had 4,996 of 5,000.
