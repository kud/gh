---
"@kud/gh-ink": minor
---

Spend the transit hold per tab, not on a global clock. A row that arrived, changed or left in a tab you were not looking at used to run out its 2.5s behind your back, so switching over showed you a list that had already settled. The marker now waits for its own tab to be displayed, and unseen marks survive the next refresh instead of being cancelled by it.
