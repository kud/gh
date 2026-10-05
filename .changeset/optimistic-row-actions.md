---
"@kud/gh-ink": minor
---

Closing a PR or an issue, and dropping your own review request, now go through the same patch layer Jira moves use. The row leaves on the keypress wearing `◌` until GitHub answers, and the patch is laid over every fetch, so a refetch that predates the close cannot put it back. It clears as soon as a fetch agrees. A refusal used to bounce the row straight back through a refresh, which read as the keypress having done nothing; it now keeps the row off the board and says so in the footer, `✗ Couldn't close #412: <reason>  w restore`, and `w` drops the patch and refetches. The `x` key takes the same path as the menu row it mirrors rather than keeping its own pessimistic copy. Closing a PR and deleting its branch patches only the close: a branch that will not delete gets its own flash, since the PR it belonged to really is closed. Merge is unchanged and still waits for GitHub.

The `◌` marker now draws on PR and issue rows as well as tickets, in the health cell, so the title does not move. And a tab's count pill drops the moment your own move or close takes a row out of it, rather than after the departing row's transit hold; the header total agrees with it. A refresh departure still counts until its hold ends, because there the pill is reporting news you have not read yet.

The action menu no longer crashes the inbox when the cursor is pushed past its first or last row.
