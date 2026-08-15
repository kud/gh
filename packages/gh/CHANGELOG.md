# @kud/gh

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
