---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

The tab badge counts the work again, at whatever depth the board files it. `topLevelCount` is now `workCount`.

A tab showing seven rows read `Review (0)`, and contributed nothing to the header total either. Two rules were cancelling each other out, and each was correct when it was written.

`depthOf(i) === 0` was a straight translation of an older `!i.indent`, from when `indent` meant "a PR hanging under its parent ticket" and a ticket was always top level. It meant _count the parent, not its children_. Then epics arrived and brought `role: "container"`, because counting an epic alongside its stories "reported five things to do where there were four". On a tab where every block has an epic, the only depth-0 rows ARE containers — so one rule said count the parent and the other said don't count the parent, and the answer was nobody.

The fix is not simply deleting the depth clause. That would count a story AND each of its PRs, which is the same inflation one level down: take a single PR sitting on a tab of its own, let its ticket become parseable from the branch so the board can file it under a story, and the total goes from 1 to 2. Nothing was created — the board merely got tidier — and the header now claims you have more to do.

So the predicate is **leaves**: a row counts when nothing hangs under it. That is the only rule under which a piece of work counts once wherever it sits. It also settles the 0-to-1 case the right way round — a story with no PRs is its own leaf and counts one, because a ticket in review with nothing to show is real work; it gains its first PR and still counts one, the story having become a name for what hangs under it. A row earns container-hood by HAVING children, which is why this belongs in the predicate rather than in a flag the host must remember to set.

A collapsed `+N more` contributes what it hides. That line is load-bearing rather than tidy: pressing return on one splices its rows into the list in place, so without it the badge would rise on expanding and fall on collapsing — a key that only changes what is drawn would change how much work you have.

Renamed because the name is why this survived review. "Top level" reads as a fact about the tree, so nobody re-asked whether the tree still meant what it had; the doc comment now states the invariant instead of narrating two dead eras.

One behaviour worth knowing about: leaf-ness is read off the rendered list, so a search that hides a story's PRs turns that story back into a leaf and it counts itself. That is deliberate — the badge describes what is on screen to act on.
