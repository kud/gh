---
"@kud/gh-ink": minor
---

Say what a refresh did, and let something else ask for one.

Applying a refresh used to swap one list for another and leave you to spot the difference against a frame the terminal had already scrolled away — the reason the manual `r` gate felt like a cost rather than a control. Now the indicator counts what is waiting (`● 2 new · 1 gone · 3 moved · r apply`), and applying marks each row that moved with `NEW` / `GONE` / `UPDATED` for a short hold, with departing rows still drawn where they actually were. Words and shapes, never colour alone.

Adds an optional `watchPath`: a stamp file that something else touches when it has changed GitHub on your behalf. Touching it makes the inbox refetch in the background — it never repaints on its own, so the apply stays yours.
