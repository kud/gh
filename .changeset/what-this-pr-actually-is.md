---
"@kud/gh": patch
"@kud/gh-cockpit": patch
---

The PR detail view says what the pull request actually is, in one line under the title.

```
Title: fix: keep the turn arrow clearing on a bot comment
+412 -38 · 12 files · fix/turn-arrow → main · kud · opened 3d ago

Health   Conversation (2 unresolved)
```

Health and Conversation answered "is this blocked" and "what has been said", and nothing answered "what is this". Health being the DEFAULT tab meant it had quietly become the about-this-PR screen while having no idea what the PR was — so this is the missing half, and nothing leaves Health to make room for it. CI, reviews and mergeability all correctly answer "is this blocked, does it want me".

**A header, not a third tab**, and the distinction is the whole design. A tab is a place you go and do something: Health has `r`, `m`, `↵`; Conversation has `x`, `r`, `R`. A metadata tab would have no verbs at all — you would arrive, read six words and press a key to leave, which is a modal built out of navigation. It would also turn `←→` from a flip into a cycle, so the frequent path pays two presses to serve the rare one. And these facts are worth most BEFORE you start reading CI results, not after you go looking for them: "oh, this is 900 lines" changes whether you open it at all.

**Size is deliberately uncoloured**, and this is the counter-intuitive part. The trap is subtler than "do not use red and green": colour those two numbers and a colourblind reader gets a near-identical pair of hues, leaving the signs as the only channel carrying anything — so the colour has added noise and taken nothing away, which is worse than plain text rather than merely no better. The `+` and `-` already do all the work. `+` always precedes `-`, never reordered by magnitude, so position is a second channel. ASCII hyphen rather than U+2212, which is ambiguous-width in some fonts and is what `git diff --stat` uses anyway.

**Five facts survived, and the ruling-out matters more than the list.** Labels are a triage tool for the LIST — you filter by them, you do not read them once inside — and their variable width would wreck a fixed row. Milestone, assignees and project cards carry zero bits in a solo cockpit. The file list is already a destination (`e` opens a picker that does it properly). `updatedAt` is free and still a no: two dates in one row means neither gets read, and staleness is the inbox's question.

A draft leads with `~ draft`, reusing the glyph the inbox row already speaks, because it changes the meaning of everything in Health below it — "6 passed, ready to merge" on a draft is a genuine misread. Prefixed rather than columnar since it is rare, and a cell that is usually empty teaches you to skip past it.

The branch pair is the only elastic element and so the only one that gives way: when the line will not fit, the head branch is dropped and `→ base` kept, because under pressure what am I merging INTO outranks what it is called. The numbers are never truncated and the line never wraps.

Cost is four field names on an existing `gh pr view`. That call is already per-PR and on demand, so they ride along for nothing where a second call would cost a round trip on every drill-in — and it gives `author` a use at last, having been fetched all along only to filter self-reviews and never displayed.
