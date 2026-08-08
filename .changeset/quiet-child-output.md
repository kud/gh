---
"@kud/gh-ink": patch
---

Stop child-process output painting outside the Ink frame. Closing an issue or PR, or moving a Jira ticket, briefly printed a stray confirmation line outside the inbox border.

zx captures a child's stdout but passes its **stderr** straight to the terminal, and `gh`/`jira` print status lines like `✓ Closed issue #42` there so stdout stays pipeable. Ink owns a region of stdout and repaints it; it has no view of stderr, so that line landed raw at the cursor, outside the frame, until the next render scrolled it away — a duplicate of a message the inbox was already rendering properly through `showFlash`.

All eleven child-process calls in the inbox now run through a single quiet wrapper, `open`'s failure text included.
