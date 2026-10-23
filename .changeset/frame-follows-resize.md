---
"@kud/gh-ink": patch
---

Resizing the terminal narrower after launch left the frame measured for the window it started in. Every render path priced itself off `COLS`, sampled from `process.stdout` when the module loads and never read again — so the header's segments and the tab strip overflowed and wrapped onto a second line, the frame ran a row past its terminal again, and Ink clips overflow from the top, which ate the header. Frame widths are read live through Ink's `useWindowSize` now, threaded to the header rule, the tab strip, the strip and focus lines, the list's row budgets, the action menu's default and every overlay. Nothing in a render path reads the load-time sample any more; `COLS` stays exported for the host, and a regression test mounts at 70 columns against a module loaded with 120 — by mount and by the resize event.
