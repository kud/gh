---
"@kud/gh-ink": patch
---

The transit hold now runs on a clock, not on your attention.

A tab's markers only counted down while you stood on that tab. Arriving to read
the news and moving on froze the hold where it was, so the markers were still
there next time you came back — and the way to clear them was to sit on the tab
doing nothing for seven seconds. That is the reader serving the animation.

Arriving is the event the hold exists for. So the clock starts the moment a tab
holding marks is first opened, and keeps running wherever you go afterwards:
another tab, a drill view, or away from the terminal entirely. A hold that
expires while you are elsewhere is spent when you get back rather than waiting
to be watched.

The half that made the per-tab hold worth having is untouched. A tab nobody has
opened has no clock at all, so news in a tab you have not visited keeps its
markers for as long as it takes you to come and collect them.
