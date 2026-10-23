---
"@kud/gh": patch
"@kud/gh-ink": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

The runtime moves to Ink 8, React 19.3 and execa 10. Nothing you see changes on purpose, but Ink 8 brings its own rendering fixes along: a frame that shrinks with the terminal is redrawn instead of leaving stale rows behind, multi-line text truncates line by line, and stray terminal replies such as focus or cursor reports no longer reach the key handlers as if they had been typed. Node 22 or later is now required across the family, since both Ink 8 and execa 10 demand it; the Ink package and the three CLIs still said Node 20, which is past its end of life.
