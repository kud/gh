---
"@kud/gh-ink": patch
---

Pressing `/` over a committed search now goes back into the query instead of wiping it. `↵` already left the field with the filter still applied, so the letter keys worked as hotkeys again, but the only way back in was a blank field and the whole term typed out again. Now `/` resumes where you left off, `esc` while typing clears it, and the hint under a committed search reads `/ edit · esc clear`.
