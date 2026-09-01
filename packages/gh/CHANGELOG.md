# @kud/gh

## 0.9.0

### Minor Changes

- 2abcca7: PR and last-comment reactions now come back with the conversation.

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

## 0.8.0

### Minor Changes

- b21b0d3: A cancelled check is no longer a failing one.

  `isFailCheck` counted `CANCELLED` alongside `FAILURE`, `TIMED_OUT` and
  `ACTION_REQUIRED`, which is a claim the token cannot support. Those three are
  verdicts — something was examined and found wanting. `CANCELLED` is the absence
  of a verdict: the run was killed, and nothing was learnt about the code either
  way. The two readings only agree on "not green", and the whose-move bands need
  the other distinction.

  gnachman/iTerm2#731 is what made it visible. Its `xcode-tests` job waited six
  hours for a macOS runner on a repo nobody here owns and was killed by Actions;
  `python-api-tests` passed. That banded under **Your move** with a red glyph
  against a PR where nothing was wrong and nothing could be done — the exact
  over-claiming the bands exist to prevent.

  `CANCELLED` and `STALE` now answer to a new `isInconclusiveCheck`, and a PR
  whose only unfinished check is one of them reads as `waiting` rather than
  `ci-fail`. No new health token: a "stale" one would band identically to
  `waiting` from all three standings, and a token that flips no outcome is a
  label. The panel is where labels belong, so it grows a fourth glyph and counts
  cancelled runs in their own column, and `checksSentence` stops dropping them
  from the total.

  `STARTUP_FAILURE` was in no set at all — the same bug pointing the other way, a
  workflow file too broken to start reading as neither failing nor pending nor
  passing. It is a verdict on the code and joins the failures.

  `r` in the health panel still finds a cancelled run. That is deliberate rather
  than incidental: it looked up its target through `isFailCheck`, so moving
  `CANCELLED` out without a second home for it would have removed the one action
  that fixes a starved job along with the false alarm.

## 0.7.1

### Patch Changes

- f7f2386: Correct the inbox cost figures quoted throughout the cache and budget comments.

  They said **111 points / 25,550 nodes**, which stopped being true when the own-PR search was capped at 30. The measured figures are **73 points / ~16,870 nodes**. Nothing reads these numbers, but they are the sort quoted back later, and a cache doc that overstates what a fetch costs argues for a longer TTL than the evidence supports.

  The `MY_PRS_LIMIT` note still cites 111 and 25,550 — deliberately, in the past tense, since it is explaining why the cap dropped from 100. `budget.test.ts` keeps `cost: 111` as a fixture: it is a chosen constant the arithmetic hangs off, not a claim about the real query.

  Also updates the TTL note, which blamed the 502s on missing the cache. The cause was asking all eight sources in one request, and `buildInboxQueries` now covers that.

## 0.7.0

### Minor Changes

- 230f4f0: Let the account-wide inbox be asked for in several requests instead of one.

  GitHub's proxy answers a request, not a query, so the ceiling on the inbox is wall clock rather than cost. Measured against an account-wide inbox on 2026-08-28: the eight-source query returns HTTP 502 on roughly two runs in three, after 10–30s, while the same eight sources asked one at a time return 200 every time — for the same 73 points and the same ~16,870 nodes. Adding sources one at a time shows a clean gradient: five is reliable, six starts failing, eight mostly fails. Repo-scoped queries were never affected, because `repo:` narrows what the search index has to walk and `author:@me` across an account does not.

  - `buildInboxQuery` takes `sources`, so any subset can be asked for. Every subset is still a complete document carrying its own `rateLimit` and `viewer`.
  - `buildInboxQueries` splits the inbox into independent queries — two sources each by default (`INBOX_SOURCES_PER_QUERY`) — to be issued in parallel.
  - `mergeInboxData` reassembles them: aliases merge by assignment, `cost` and `nodeCount` sum, and `remaining`/`resetAt` take the scarcest reading.
  - `INBOX_SOURCES` and the `InboxSource` type name the eight sources.

  `buildInboxQuery()` with no arguments emits the same query it always did, byte for byte.

## 0.6.0

### Minor Changes

- aa9ae55: Ask for 30 of your own PRs, not 100

  The single biggest lever on the query's cost, because connections **multiply**:
  the health and conversation fragments hang ~80 nodes off each PR, so the outer
  number is a multiplier on all of them. GitHub scores a call by the nodes it could
  return rather than by how many calls you make — which is why batching saves
  nothing and this saves a great deal.

  100 × 80 was 8,000 nodes from this one search, of ~25,550 for the whole query at
  a measured 111 points. At 30 it is 2,400, roughly halving the query. It was 100
  for no reason beyond the search API's own maximum; every other search here
  already asks for 20-30.

  `issueCount` is now fetched alongside, so the cap cannot drop rows in silence. It
  is a scalar and costs nothing, and a host that knows the true total can say what
  it is not showing.

## 0.5.1

### Patch Changes

- 7be0454: Select `rateLimit { cost nodeCount remaining resetAt }` on the inbox query.

  It is free — `rateLimit` does not count against itself — and it is the only authoritative source for what the query costs. Every estimate made about that cost on 2026-08-14 was wrong, one of them by 25×, because GraphQL cost is node-count based and nested connections multiply: `reviewThreads(first: 50)` beneath `search(first: 100)` is 5,000 nodes from two lines of query text.

  A consumer can now log what a fetch spent instead of inferring it from a rate-limit delta, which measures whatever else happened in the window rather than the thing you asked about.

## 0.5.0

### Minor Changes

- 37586f4: Add `shape: "minimal" | "full"` to `buildInboxQuery`.

  The inbox query costs **111 GraphQL points** against a 5000/hour budget — a nodeCount of 25,550, driven by `statusCheckRollup.contexts` appearing on five PR sources with `reviewThreads(first: 50)` multiplying beneath each. That is 45 refreshes an hour for any caller, however little of the result it reads.

  `minimal` drops health, conversation and labels, keeping identity only: type, number, title, url, `isDraft`, timestamp and repo. Measured against GitHub's own `rateLimit { cost }`, that is **1 point and a nodeCount of 290** — a 99% cut, taking a poller from 45 refreshes an hour to effectively unbounded.

  `full` remains the default, so every existing caller is untouched. Reach for `minimal` only when nothing downstream reads health: the fields do not degrade when absent, they vanish, and `computeHealth` resolves to a confidently wrong token rather than an empty one.

  `isDraft` moves out of the health fragment into each source's base field list. It is identity rather than health, and a draft rendering as an open PR would have been a wrong answer rather than a missing one.

## 0.4.1

### Patch Changes

- Select `author { login }` on `myPRs` too, so every PR section agrees on its shape.

  It was the one section omitting it — the search is `author:@me`, so the author looked redundant. It is not: a consumer reading `author` gets `undefined` on exactly the section holding your own PRs, and nothing in the response says whether the field was absent or genuinely unset.

## 0.4.0

### Minor Changes

- 67c40eb: Carry `__typename` on every conversation author in the inbox query, so a consumer can tell a GitHub App apart from a person.

  A login cannot do this on its own: GraphQL reports app authors bare (`greptile-apps`), without the `[bot]` suffix REST adds. Whose-turn logic needs the distinction because a push answers a machine's review and does not answer a person's.

## 0.3.0

### Minor Changes

- 1bdf706: Add `buildInboxQuery` — the account-wide "what's on my plate" query in one
  GraphQL round-trip: my PRs, review requests, reviews given, assigned work,
  issues and PRs on my repos, and recently closed.

  Extracted from ambre's cockpit, where it was the last piece of shared GitHub
  logic still living in a consumer. Query only — assembling the result into
  sections stays with the surface, since a terminal inbox and a web dashboard
  group the same rows differently.

  Two changes on the way across: `repo` and the done-window are now named options
  (`buildInboxQuery({ repo, doneWithinDays })`), and the window date is computed
  per call rather than at module load — a long-running server would otherwise
  freeze "recently done" to the day it booted.

## 0.2.0

### Minor Changes

- f476456: `fetchPrComments` now returns the PR description as the conversation's first entry, the way GitHub's own Conversation tab treats it. A PR whose body carries its whole argument previously rendered as having nothing said on it, which reads as empty rather than unanswered.

  Conversation comments also carry `createdAt`, and a null body (what GitHub returns for a description-less PR) no longer throws.
