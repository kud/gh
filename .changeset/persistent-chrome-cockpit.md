---
"@kud/gh-cockpit": minor
---

Drilling into a pull request or an issue keeps the cockpit around it now: the frame, the title row and the footer persist, and the detail — health, conversation, file list, check log, AI launcher — renders inside them instead of on a bare screen. Each view hands its title up as the header breadcrumb and its keys down to the persistent footer through `useChrome`, so the same component still draws its own frame when mounted outside the inbox. Nothing else moves: the tabs, rows and keys inside each view are unchanged.
