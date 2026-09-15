---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

The rail is there on a launch painted from the cache, and takes a third of a wide frame.

The sidebar arrived only with a fetch. A launch that trusted a fresh cache painted the rows and never refetched, so on exactly that launch `i` did nothing and the footer did not even offer it — "sometimes I can't see the initiatives". The cache now carries the rail beside the rows and the launch paints both; a cockpit woken by a sibling's shared cache takes its rail the same way. Pinned by a test that mounts from a seeded cache and presses `i`.

Because the sidebar now goes through JSON, the host's words for `live` move off the data: `Sidebar.liveLabel` becomes a `liveLabel` prop on `App` and on `SidePanel` (`LiveLabel` is exported), vocabulary being configuration rather than a fetch result. A host on 0.53.0 that set it on the sidebar moves one line.

The rail's width follows the frame: `railWidth(cols)` is a third of it, floored at the 52 the grid was laid out for and capped at `SIDEBAR_COLS`, now 64. On a 200-column terminal an epic title keeps its last words; on a 120-column one the list keeps its.
