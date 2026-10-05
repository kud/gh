---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

Switching tabs no longer shifts the list sideways. The `#n` cell and the trailing columns were measured over the tab on screen, so a tab holding `#1234` started its titles a column to the right of one holding `#157`, and the ages moved with them. Both are now measured once over every tab's pull requests and issues, so the columns stay put; which columns a narrow tab gives up is still decided per tab.
