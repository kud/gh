---
"@kud/gh-ink": minor
---

Rows carry a real depth, so a tree can be three levels deep.

Every row type declared `indent: boolean`, which can only say "top level" or
"under something". A board that groups epic > story > PR has three levels, so
the epic and its own story landed in different groups and read as unrelated
rows — the thing the tree exists to show was the thing it could not express.

Rows now carry `depth?: number`. `indent` is still a legal way to spell
`depth: 1` and every existing producer keeps working untouched, but it is read
in exactly one place — the new `depthOf` helper — rather than at the twenty-odd
sites that used to read it directly. That part matters more than the new field:
a site still reading the boolean would price a `depth: 2` row as top level,
which is a worse bug than the one being fixed, so the redundancy is survivable
only because it has a single reader. `indent` is deprecated and goes at the next
major.

Three behaviours had to be chosen rather than ported.

`C` over a tree used to copy from the nearest top-level row, on the rule that it
should hand over the same tree wherever the cursor sat inside it. That rule was
a consequence of there being two levels, not a principle: with three there are
two candidate roots and the question has two honest answers. Copying from the
top level would hand you a whole epic — including the PRs of sibling stories
that were never on screen together — which is the "a ticket copied half of
itself" bug from the other direction. The walk now stops at the first row that
is a task, or at depth 0, whichever comes first. On two-level data both terms
coincide with the old rule, which is why every test written before this still
passes unchanged.

The blank line between trees stays binary and only a top-level row can open one.
Without that guard the naive reading puts air between an epic and its own story
— a gap inside a tree, which is the opposite of what it is for — and a
non-binary gap would mean the window budget prices a non-binary cost, which is
where a previous overflow came from.

A row's glyph run is now computed from its ancestors rather than from a single
"am I last" boolean. Past two levels the stem has to keep running down the left
of a subtree that is not the final one, and a collapsed `+N more` sitting under
a non-last story used to draw a bare corner — losing its ancestor column while
every visible sibling above it kept theirs.
