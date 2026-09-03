---
"@kud/gh-ink": patch
---

Takes `@kud/ink-ui` 0.20.2, which removes the last two jumps from the tab rule.

The rule's length flickered a column wider and back on alternate frames as it
travelled — its edges were rounded independently — and the tab label lit up the
instant `active` changed, so for the length of the slide the destination was
already bold while the rule was still crossing towards it. The highlight now
travels with the rule.
