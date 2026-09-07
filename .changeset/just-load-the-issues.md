---
"@kud/gh": patch
---

Issue sources load everything instead of the first 30, so the tabs stop being a keyhole.

The cap was 30 across all eight searches, and that number was chosen for **pull requests**. The issue sources inherited it. A PR drags roughly 80 nested nodes behind it — `reviewThreads(first: 50)`, check contexts, labels — which is why `myPRs` at 30 is genuinely half the cost of the whole call. An issue drags about 12: one comment and ten labels. Same number, two completely different weights, and only one of them was ever measured.

Measured against the real account, with the selections that actually ship:

```
repoIssues  first:30    cost 1    360 nodes
repoIssues  first:100   cost 2   1200 nodes   ← every issue there is
assigned    first:100   cost 2   6100 nodes
the real 2-source batch at first:100:  cost 4, 2400 nodes, 5.3s
```

Loading every issue costs about three points a fetch. Against a 5000/hour budget and a ten-minute cache — six fetches an hour — that is roughly 0.4% of budget. The cap was buying nothing on these three sources.

What it does spend is headroom against the proxy, which fails on **wall clock** rather than cost: eight sources at ~16,870 nodes returns 502 on two runs in three. The batch above is 2,400 nodes and 5.3 seconds, about a seventh of that. That is what makes this safe rather than merely cheap, and if 502s start appearing this is the first thing to put back — it is one constant.

`assigned` is the one to watch. It is a mixed source, so a PR assigned to you arrives with the full health fragment behind it, and its node count is budgeted for the PR shape whatever actually comes back — hence 6,100 nodes for 38 rows. A day spent with fifty PRs assigned would make it the heaviest search in the query.

The PR sources keep their caps, for the reason the caps existed.

The visible effect is that the truncation notation mostly stops appearing at all. `sampled` is set only when a search actually truncates, so a tab that now returns everything shows a plain count with no fraction — which is the right answer to "I don't understand these numbers": not a better way to say what is missing, but nothing missing to say.
