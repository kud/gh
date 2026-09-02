---
"@kud/gh-ink": minor
---

The repo fence is a row you can stand on.

It was scenery: `moveCursor` stepped over it, `firstSelectable` started past it,
and every key arm returned early on it. So the one thing on screen that names a
whole repo was the one thing you could not act on — opening the checkout meant
finding a PR in that repo first and pressing `j` from there, and there was no way
at all to take every URL under a fence in one go.

Now ↑/↓ stop on it, and it answers the same letters a row does, one level up:
`↵` (and `d`, and `j`) opens the local checkout in a new iTerm tab, `o` opens the
repo on GitHub, `c` copies its URL, and `C`/`O` take every URL in the group
beneath it — the run of rows down to the next header, which in a recency-sorted
tab is the group you were looking at rather than a union assembled from three
places on screen you cannot see at once. Collapsed rows count: a `show-more` is
not a gap in the group, it is the rest of it.

Three things this is careful about.

The fence is a stop in **both** directions, unconditionally. Skipping it going
down and landing on it going up would make ↓ then ↑ end somewhere other than
where it started, and an arrow pair that is not its own inverse reads as the list
drifting rather than as a shortcut.

A `subgroup-header` is still stepped over. The two look alike and are not — a
band label names an arrangement of rows and has nothing behind it to open, so
landing there would be a keystroke spent on a row whose every key is inert.

Unselected, the fence draws exactly what it always drew, to the byte. Selected,
it takes the cursor into the two spaces it already reserved — the same cell every
item row draws its `❯` in, so nothing shifts — then undims and bolds its repo
name. The chevron alone was not enough: every other row puts full-brightness
content beside the cursor, so a dim fence with a bright gutter reads as a stray
glyph in a margin, and dim is this list's own "you may skip this". Luminance and
weight, never hue.

Two consequences elsewhere. `ExtensionTarget.item` has always been documented as
absent on a header row, which was true for free while no header could be
selected and now has to be stated — no extension body expects a `repo-header`.
And the footer strip is context-sensitive, because on a fence the fixed one was
wrong: it offered `m`, which opens nothing there, over the two keys that do.
