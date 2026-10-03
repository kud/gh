---
"@kud/gh": minor
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

A host can now grow a first tab that answers "what needs you". The inbox query selects labels on every pull request source, exactly as it already did on issues, so a host reading a decision label off a PR row no longer pays a round trip per row to learn what the row already knew. Rows carry an optional host-supplied `needsYou` marker — the package never derives it — and the needs-you section lays itself out around it in two bands, Decide then Merge, with the decision line drawn in place of the title so the tab reads as a list of questions rather than a list of branches. Drilling in pins a Decision block under the summary, and the drill views grow the keys the moment calls for: answer posts a comment and hands follow-through to the host's `answered` hook, diff pages the PR in the viewer's pager, merge and close ask first and then do it, and ready marks a draft for review. Typing a search still finds the decision's own words.
