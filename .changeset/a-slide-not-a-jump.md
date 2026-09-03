---
"@kud/gh-ink": patch
---

Takes `@kud/ink-ui` 0.20.1, where the tab underline slides rather than jumping.

The rule travelled as of 0.20.0 but read as a jump followed by a bubble: its
steps landed faster than the terminal repaints, so several coalesced, and it
eased out only — which starts at full speed and put most of the distance in the
first visible frame. It now eases in and out over twelve steps at 28ms, roughly
one step per repaint.
