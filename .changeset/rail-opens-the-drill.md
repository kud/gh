---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

↵ on a rail row opens the initiative in the drill; the rail carries a mark.

An initiative is a container of work, and ↵ on it now hands it to whichever extension claims task rows — the ticket drill on a Jira cockpit — the same screen its children open, instead of the browser. Only where no extension claims tasks does ↵ still fall through to the browser; `o` reaches it directly on any host, and the rail's footer says so.

`SidebarRow` gains `marker` / `markerColor`, the same pair `TaskRow` takes, drawn in the facts line's indent immediately before the key — a priority arrow on an epic, drawn where the list draws it on a story.
