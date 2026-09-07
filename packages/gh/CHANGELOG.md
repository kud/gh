# @kud/gh

## 0.12.3

### Patch Changes

- a853ce5: The PR detail view says what the pull request actually is, in one line under the title.

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

## 0.12.2

### Patch Changes

- cd62fd9: Issue sources load everything instead of the first 30, so the tabs stop being a keyhole.

  The cap was 30 across all eight searches, and that number was chosen for **pull requests**. The issue sources inherited it. A PR drags roughly 80 nested nodes behind it — `reviewThreads(first: 50)`, check contexts, labels — which is why `myPRs` at 30 is genuinely half the cost of the whole call. An issue drags about 12: one comment and ten labels. Same number, two completely different weights, and only one of them was ever measured.

  Measured against the real account, with the selections that actually ship:

  ```
  repoIssues  first:30    cost 1    360 nodes
  repoIssues  first:100   cost 2   1200 nodes   ← every issue there is
  assigned    first:100   cost 2   6100 nodes
  the real 2-source batch at first:100:  cost 4, 2400 nodes, 5.3s
  ```

  Loading every issue costs about three points a fetch. Against a 5000/hour budget and a ten-minute cache — six fetches an hour — that is roughly 0.4% of budget. The cap was buying nothing on these three sources.

  What it does spend is headroom against the proxy, which fails on **wall clock** rather than cost: eight sources at ~16,870 nodes returns 502 on two runs in three. The batch above is 2,400 nodes and 5.3 seconds, about a seventh of that. That is what makes this safe rather than merely cheap, and if 502s start appearing this is the first thing to put back — it is one constant.

  `assigned` is the one to watch. It is a mixed source, so a PR assigned to you arrives with the full health fragment behind it, and its node count is budgeted for the PR shape whatever actually comes back — hence 6,100 nodes for 38 rows. A day spent with fifty PRs assigned would make it the heaviest search in the query.

  The PR sources keep their caps, for the reason the caps existed.

  The visible effect is that the truncation notation mostly stops appearing at all. `sampled` is set only when a search actually truncates, so a tab that now returns everything shows a plain count with no fraction — which is the right answer to "I don't understand these numbers": not a better way to say what is missing, but nothing missing to say.

## 0.12.1

### Patch Changes

- 9dd17b8: Merged tabs report a true total, and draw it as `Issues (20/97)` instead of `Issues +129 (20)`.

  Two problems, one visible and one not.

  **The notation misread.** A tab whose rows are a window onto a larger result set had nowhere to say so — `Tabs` offered `label` and `count` and nothing else — so the overflow got smuggled into the label as `Issues +129 (20)`. `+` is an operator: it tells the reader to add, with nothing on screen to add it to. The arithmetic even works, which is what makes it vicious — a reader who obeys gets a real number for a question nobody asked, with no signal they have misread anything.

  `@kud/ink-ui` now has a `total` field, so the notation is a fraction: part-of-whole, page 3 of 12, the most over-learned notation there is, and nobody tries to compute with a slash. It rides on a glyph rather than a hue, so it survives dimming, greyscale and colourblindness — and it keeps magnitude, which is the half that matters: `(30/37)` and `(20/149)` say very different things about how far a tab can be trusted, where a bare truncation flag says only "incomplete". It is also narrower than what it replaces. One number now means the tab is whole; two mean you are looking at a sample.

  **The total was wrong.** A merged tab summed its sources' `issueCount`s, which is only valid if the sets cannot intersect — and `Issues` merged `repoIssues` with an `authoredIssues` that asked for the superset. Measured on a real account: 94 own-repo issues, 95 authored, **92 of them the same issues**. The sum claimed 189 where the truth was 97, and `+129` double-counted the overlap the same way. Overlap is the normal case rather than an edge — a plans repo you own and file into is in both sets by construction.

  The fix is not to measure the overlap but to remove it: `authoredIssues` now asks for `-user:@me`, which is what the host already documented it wanted ("issues I filed on repos I don't own") and already achieved at row level by deduping. Only `issueCount` never knew. 94 + 3 = 97, and the sum is trivially right because the sets cannot intersect. `reviewed` has carried this shape all along via `-review-requested:@me`, which is why `Review` was never wrong and `Issues` was.

  **The invariant, now written next to the queries:** the negations in a merged tab's queries mirror the order `pick` claims rows in. It composes at any number of sources, where measuring the overlap does not — and it is exactly what gets forgotten when a source is added.

  Cost goes down rather than up. No new selection, no new request, and `authoredIssues` returns 3 rows instead of 30 — of which about 27 were duplicates thrown away, while the handful of external issues that are the source's whole purpose might not have been in that window at all. Better rows, fewer nodes.

  Under a `repo:` scope the source is dropped entirely: `user:@me` is replaced rather than joined there, so the negation has nothing to name and the search degrades to a strict subset of `repoIssues` — every row discarded, paid for on every scoped fetch. Both query builders resolved the source list independently, which is precisely the shape where a change like that half-lands, so they share a `sourcesFor` helper now.

  The fraction is dropped while a search or repo filter is active. `sampled.total` is what the searches matched and `count` is what this frame draws, so a filter moves the numerator and cannot move the denominator — a fraction of two different populations reads as precise and is worse than none. That decision lives in the package rather than the host because the package is the only layer that knows a filter is on, which is also why the total arrives as a number rather than baked into a label.

## 0.12.0

### Minor Changes

- 5e4b549: A section that only shows part of what it matched no longer invents arrivals and departures.

  Three of the eight inbox searches return fewer rows than they match. Measured 2026-09-07 on a real account: `assigned` 37 against a cap of 30, `repoIssues` 94 against 30, `authoredIssues` 95 against 30 — two of them showing under a third of what they found.

  That is a display gap, and it was not the expensive half. A surface that marks arrivals and departures compares one fetch with the next: it asks what changed in the world and reads the answer off a fixed-size window. Where the window is smaller than the world those are different questions. Any update to any of those 95 issues reorders the window, evicts one, and the eviction gets reported as news about a row that never moved — every fetch, all day. The board reports its own scrolling, the header counts it as `12 new · 9 gone`, and the marks that do mean something get read as more of the same.

  `inbox.ts` already carried the fix in a comment: `issueCount` is fetched "so the cap can never drop rows in silence". It was fetched for `myPRs` and no other source, and read by nobody — the guarantee lived in prose and not in code. All eight sources now ask for it, the caps move into `SOURCE_LIMITS` so a cap and its query cannot drift into two numbers, and `sourceCoverage` reports what each source matched against what it was allowed to return.

  `Section` gains `sampled`, and `diffSections` raises no presence mark inside a sampled section — no `in`, no `out`, no `moved-in`, no `moved-out` — and keeps those rows out of the headline counts too. Three things are deliberately preserved:

  **`changed` still fires.** Truncation corrupts which rows you can see, never what a row you can see says. A title or a health token that moved between two fetches is real news about a row present in both, and suppressing it would throw away the half of the signal that still works.

  **Departing rows are still held in place.** Only the mark is suppressed; the row is still spliced back at the index it held, because a row vanishing from under the cursor mid-read is jarring whether or not anything is drawn beside it.

  **The quarantine is per section.** A whole section beside a sampled one keeps its arrivals, so one noisy source cannot silence the board.

  A section is treated as sampled if either fetch says so, since a source can cross its cap between two of them — reading the flag off the newer fetch alone would let the crossing report the entire backlog as arrivals, once. And a source that answers without an `issueCount` counts as whole: an invented sample silences real news, which is the worse of the two failures.

## 0.11.0

### Minor Changes

- b5512f9: Extract the workflow semantics into `@kud/gh-workflow`, a pure package a browser can import.

  `whoseMove`, `sortItems`, `layoutGHItems`, the filters, the row types and the GraphQL node → row mapping were spread across `gh-ink`'s 5,600-line `inbox.tsx` and `gh-cockpit`'s shared layer, entangled with Ink, `zx`, iTerm pane launching and a `mkdirSync` that ran on import. None of it was ever terminal-specific — only its address was.

  `@kud/gh` splits `fetchHealth` out of `health.ts` so the health derivation is importable without `execa`, and gains `./health` and `./inbox` subpath exports for consumers that must not pull the CLI path. The terminal surfaces re-export by name, so nothing on their public API moves.

  Purity is asserted against the built output rather than the source: in the workspace every forbidden dependency is installed, so an accidental import compiles, typechecks and only fails in a consumer's bundle.

  Note for consumers: `@kud/gh-workflow@0.1.0` was published against `@kud/gh@0.9.0`, which predates the `./health` subpath it imports, so it fails to resolve outside this workspace. `0.1.1` pins the version that actually exports it.

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
