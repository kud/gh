---
"@kud/gh-ink": patch
---

Opening a drill or an extension body left the frame three rows short of the terminal, five with a filter kept, so the bottom border floated above the screen's edge. The overlay band took the list's height, and the list's height had already paid for the tab strip and the filter bar, both of which the overlay hides. The band now takes those rows back, and every state draws a frame exactly as tall as the terminal, pinned by a new test across board, filter, help, drill, extension, empty, failed and loading states at three terminal heights.
