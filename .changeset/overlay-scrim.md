---
"@kud/gh-ink": minor
---

Overlays now float over the browse list instead of replacing it. Pressing `?`, `m`,
`f` or `e` used to blank the screen and show the panel alone; the list stays put
underneath, dimmed, so the panel reads as a modal over the app rather than as a
different screen. The panel is opaque (a background, since Ink leaves an unpainted
Box transparent) and sits in normal flow with the backdrop lifted out, so one taller
than the list area grows the row rather than being centre-clipped.
