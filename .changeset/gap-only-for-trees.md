---
"@kud/gh-ink": patch
---

Only put a blank line above a ticket row when a tree actually starts or ends there.

`gapsAbove` treated every `task` row as the head of a group, so a tab whose tickets have no PRs got double-spaced for nothing. On the Off Board tab that is ten ticket rows drawn over nineteen lines, which makes the tab look shorter than it is and pushes real rows behind `↓ N more`.

The gap now asks whether the row above or below is a child. A ticket with PRs beneath it still gets air, and so does the ticket immediately after one — a boundary belongs to both groups. A run of bare tickets renders as the plain list it is. A collapsed tree counts as a tree, so hiding PRs behind `show-more` does not also drop the spacing.

`isChildRow` moved up beside `gapsAbove`, its only non-trivial reader; it had been sitting 1,100 lines further down and the new dependency held only by module-evaluation order.
