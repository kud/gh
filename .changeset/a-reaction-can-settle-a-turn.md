---
"@kud/gh": minor
---

PR and last-comment reactions now come back with the conversation.

Whose turn it is has had two inputs: who spoke last, and whether a push landed
after them. Both are readings of what other people did, and there was no way for
the viewer to say anything at all — which is fine right up until the inference
is wrong in a direction no amount of reading the PR harder can fix.

The case that forced it: a CI bot posted an autoplan comment on a PR of the
viewer's own, with no commit after it. The bot held the last word, so the row
read as theirs to answer; nothing was owed, checks were green, no thread was
open, and the PR was simply waiting on somebody else's approval. The existing
escape hatch — a push answers a machine — could not reach it, because the bot
spoke after the last push. The assumption underneath was that every turn is
clearable by words or by a push, and a bot autoplanning on a base-branch change
produces one clearable by neither.

A reaction of the viewer's own is the third thing that can settle it, and it is
a good store for the answer: durable, visible on the PR itself, and outliving
any cache this side keeps. So `reactionGroups { content viewerHasReacted }` now
rides along at two levels — on the PR, and on the last comment — and what the
two mean is deliberately different. A comment-level reaction can only speak for
that comment, so a newer one undoes it; a PR-level one speaks for the PR, where
no later comment should quietly erase it. Consumers get the shapes; none of the
policy is here.

Cheaper than it looks, and the shape is the reason. `reactionGroups` is a plain
list of the eight content types rather than a connection, and `users` — the one
sub-selection that would need paginating — is not asked for, because nothing
reads the count. Measured at cost 1 for a PR carrying both. Thread comments get
neither: `reviewThreads` is already `first: 50`, and eight more fields fifty
times over is the multiplication the node budget exists to prevent.

Rides the `minimal` shape out with the rest of the conversation, so a caller
paying for none of this still pays for none of it.
