---
"@kud/gh-ink": minor
---

Three cells on the inbox row stop spending the middle tier on nothing: a label every row in the section carries is suppressed, the age pair reads `6d (1w)` rather than `6d · 1w`, and the repo name in a section rule steps out of the furniture tier.

The row has exactly three neutrals — default for the answer, `secondary` for context, `dimColor` for furniture — and the trailing band had stopped reading as three of anything. Each of these is the same fault: a tier spent on something that says nothing, or withheld from something that does.

**The label cell.** `impliedLabels` already suppresses a label a repo's convention puts on every issue, because a label on every row is the group header repeated. It is keyed on REPO, which is right for a repo convention and blind to uniformity that comes from the QUERY — a `label:plan` view spanning five repos draws `plan` on all sixty rows while only the one repo in the config is exempt. The section axis is now measured too, over `section.items` rather than the visible window (a cell that appears as you scroll is worse than one always there) and only where the section holds more than one row (one row makes every label trivially uniform, and suppressing there would hide the only classification on screen). What this costs when it is wrong is not a wasted cell but a wasted tier: a tone the eye meets on every single row is calibrated to and filed as background, so a uniform label teaches the reader that `secondary` means nothing — and every varied label further down the list inherits that.

**The age pair.** It was `6d · 1w`, on the argument that the left value is by construction the smaller of the two and that the invariant teaches the order without a legend, a colour or a second glyph column. That fails twice. Knowing which value is smaller is not knowing which value is _which_ — monotonicity establishes that an ordering exists and says nothing about what the two quantities are. And it only reads as ordered inside one unit: `0m · 1d` is obviously ordered, while `6d · 1w` needs weeks converted to days before the ordering is even visible, and cross-unit pairs are the common case rather than the edge, because GitHub ages cross units within a fortnight. So the one worked example that would teach the pattern is the one almost never on screen. A parenthetical is read as subordinate to the number beside it by everyone, which kills the "two peers separated by a dot" reading: the bare value is the age, the parenthetical the lifetime. It costs nothing — both forms are seven columns — and it frees the `·` to mean one thing everywhere else on the row.

The pair is also tiered now. Both halves were `dimColor`, which said "you may skip this" about the half you are actually scanning for. Last-activity takes `secondary`, the parenthetical stays furniture. The parentheses carry the meaning alone for a reader who sees no colour; the tier only reinforces them.

**The section rule.** `── kud/gh ───` drew the repo name and the dashes at the same tier, so the one word on that line that answers "what am I looking at" was painted as skippable. The name takes `secondary`; the rules stay furniture. An active header keeps its own colour and bold.

No new token and no new hue anywhere in this — every change moves a cell between the three neutrals the row already has.
