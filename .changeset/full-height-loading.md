---
"@kud/gh-ink": patch
---

The loading frame fills the terminal

It hugged a single line and then snapped open when the fetch landed, which reads
as a redraw glitch rather than as data arriving. It now takes the same height
budget the browse screen gives its list, so the frame is the right size from the
first paint.

On a cold launch this is the only thing on screen, so it is also the first
impression the cockpit makes.
