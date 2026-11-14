---
"@kud/gh-ink": minor
---

The inbox can now keep a PR's status live without a full refetch. A host that passes `rowFetcher` is asked, every 30 seconds and only while some PR has checks running, about those rows alone. A verdict that changes is drawn where the row already stands, marked `updated`, with the cursor and the list left exactly as they were. When the new verdict also changes whose move it is, the row waits a beat so the change can be read in place, then holds until the keyboard has rested for four seconds before it travels to its new group with the existing `moved` marks and tab pulse. It never jumps between two keypresses. Polling stops the moment nothing is running, and it pauses under the same budget guard as auto-refresh.
