---
"@kud/gh-ink": patch
---

Show a repeated ticket in full again

A ticket heading two bands rendered its second appearance dimmed and key-only.
Reverted: the duplication was never the confusing part, and cutting the summary
made the second band harder to read than the repetition ever was.

The split itself stands — a ticket with one PR needing you and another in review
belongs in both, because the band reads each PR rather than the ticket.
