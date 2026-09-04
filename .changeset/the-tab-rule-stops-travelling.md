---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

`@kud/ink-ui@0.22.0`, which takes the sliding underline off the tab bar. The rule lands under the active tab on the frame the tab changes, and the highlight lands with it — no travel, no lead-and-follow.

It reaches the cockpit through this bump rather than through anything here, and it is worth a line because the tab bar is the one component drawn across the top of every screen: a half-tuned animation there is the first thing the eye goes to and the last thing that should be asking for attention. The slide was three releases of tuning that had not converged, so it was parked whole on `feat/tabs-underline-animation` upstream — step count, ease shape and the lead/follow split intact — to be finished rather than rewritten. Tab markers are untouched.

All six packages move together, which is the invariant this repo now states outright: a second copy of the component library in one process is a module-level singleton configured in one instance and read from the other.
