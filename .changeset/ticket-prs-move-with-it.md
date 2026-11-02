---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

A ticket's PR rows now move and leave with it, so none are left behind under the wrong heading. Moving a ticket to another stage, or landing it, used to take the ticket alone: its PRs stayed in the tab it left, drawn as tree branches under a band heading, and two PRs from different tickets could end up joined as siblings. The tab count went on including them too. Now a ticket and the PRs under it are one block that travels together and keeps its shape in the new tab, refresh marks treat it as one move, and an epic's stories still stay where their own status puts them. A nested row that ever turns up with nothing above it is drawn at the top level rather than hung from the nearest heading. `blockEnd` is exported for hosts that need the same span.
