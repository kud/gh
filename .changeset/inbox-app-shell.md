---
"@kud/gh-ink": minor
---

Add the inbox shell — the browse screen, action menu, layout, navigation and `App` extracted from ambre's cockpit, so a second surface can have the same interface with different queries.

Host-supplied where the shell used to assume its first host: `detailFor` (the drill-in view, on the same seam as `extensions`), `title` (the header brand, loading line and empty message), and `isWorkRepo` / `initialIncludeWork` (the work ⇄ home split). The duplicated `Health` union and its display tables are gone in favour of `@kud/gh` and this package's own `health-display`.
