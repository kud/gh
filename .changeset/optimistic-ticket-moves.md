---
"@kud/gh-ink": minor
---

Moving a Jira ticket no longer leaves the row standing in its old tab until the next fetch. A host that passes the new `tabForStatus` prop, which maps a transition's destination status to a tab, now sees the row land in that tab the moment the move is chosen, marked `◌` until Jira answers, and the tab counts move with it. The move is held as a patch laid over every fetch, so a refetch that predates Jira's index cannot bounce the row back; it clears as soon as a fetch agrees, and after 30 seconds at the latest. If Jira refuses, the row stays where it was put and the footer says so, `✗ Couldn't move SHOP-1234: <reason>  w restore`, until `w`, `esc` or eight seconds; `w` drops the patch and refetches the real position. Without `tabForStatus`, or when it returns null, moves behave exactly as before.
