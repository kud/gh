---
"@kud/gh-ink": minor
"@kud/gh-pr-comments": patch
"@kud/gh-cockpit": patch
---

The comments panel now spends its accent colour on the cursor alone. The PR title, every author's name and the selected thread were all drawn in the same orange, so on a long review a dozen names competed with the one mark that meant "you are here"; names are now bold, headings are bold with their counts muted, and only the cursor and the selected thread carry the accent. Each author is followed by how long ago they wrote (`3d`), from a timestamp that was already fetched and never shown. Resolved and outdated threads fold to a single line — their location, why they are settled, and how many comments they hold — instead of being drawn in full by default, so the threads still owed a reply are no longer buried; they keep the cursor, so `x` can reopen one where it sits, and `R` unfolds them as it toggled them before. Cockpit's Conversation tab shows the same panel and changes with it.
