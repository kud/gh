---
"@kud/gh": minor
---

A host can now tell unassigned issues from assigned ones, and see what other people closed on its repos. Four opt-in sources split `repoIssues` and `authoredIssues` by assignment (`repoIssuesUnassigned`, `repoIssuesAssigned`, `authoredIssuesUnassigned`, `authoredIssuesAssigned`), each pair disjoint so its counts sum to the parent's; the assigned half uses `assignee:*`, because GitHub search silently ignores `-no:assignee` and returns the whole parent. `othersDone` lists PRs closed by someone else on repos you own, disjoint from `recentlyDone`. None of them joins the default query, so existing callers fetch exactly what they did; they are listed in `OPT_IN_INBOX_SOURCES`, and `ALL_INBOX_SOURCES` is what limits, coverage and health enrichment now walk.
