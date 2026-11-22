---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

A pull request's head branch reached the shell line the inbox types into iTerm2 without quoting. Git allows `;`, `$`, `|` and backticks in a branch name, so a branch named by any contributor to a watched repository could run commands on the owner's machine when they pressed "Switch here", opened the PR in a new tab or pane, or launched an agent on it from cockpit; two of those paths also spliced the name straight into AppleScript source. Every remote value in those lines — branch, repo slug, fork name, checkout path — now goes through one shared `shellQuote`, refs sit behind `--`, a branch name git itself would refuse is refused before anything is typed, and "Switch here" travels through the same `ITERM_CMD` route as `runHere` instead of the AppleScript string. The quoting helpers and the pure line builders (`shellQuote`, `isSafeBranchName`, `checkoutCmdFor`, `switchCmd`) are exported from both packages.
