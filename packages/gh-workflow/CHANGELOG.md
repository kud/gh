# @kud/gh-workflow

## 0.7.1

### Patch Changes

- bc80007: `PillVariant` now includes `group`, as `@kud/ink-ui`'s has since 0.25.0.

  The soft-fill changeset said `pillVariant` accepted the new `group` variant; only
  ink-ui's union did. `@kud/gh-workflow` mirrors that union structurally so it
  carries no renderer dependency, and the mirror had not moved — so a host typing
  its pill from ink-ui could not assign a `group` pill to a `TaskRow`, while every
  package here typechecked. The mirror's comment now says to extend it in the same
  commit ink-ui's pin moves.

## 0.7.0

### Minor Changes

- befcc51: A PR row by someone else now says how big the diff is.

  A review queue of forty rows gave no way to tell a six-line config bump from a
  forty-file rewrite without opening each one; the size sat one keypress away in
  the PR header, which is too late to decide whether to press the key. Every
  open-PR search in `@kud/gh` now selects `additions deletions changedFiles` —
  three scalars on nodes already fetched, measured at zero cost — in the base
  identity list rather than the health set, so the `minimal` overflow tier
  carries them too. `GHItem` gains the three fields, `toGHItem` sets them when
  the node has them and leaves them undefined otherwise, and `sizeOf` and
  `filesOf` move into `@kud/gh-workflow` beside `relativeTime` so the row and the
  header format one string. The inbox row draws `+18 -4` at the head of its
  trailing group on any PR not your own — plain, undimmed, one colour, magnitude
  carried by width — and gives it up after the author and before the thread
  count when the frame narrows. `@kud/gh-cockpit` re-exports `sizeOf` from its
  summary view so existing imports keep resolving.

### Patch Changes

- Updated dependencies [befcc51]
  - @kud/gh@0.16.0

## 0.6.1

### Patch Changes

- 61bfa03: A row's pill is now outlined; event pills stay solid.

  The law: the column says where it sits, outline says what it is, solid says
  something happened. `TaskRow.pill` is a classification — `epic`, `bug`, `spike`
  — so the inbox draws it with `@kud/ink-ui`'s new `tone="outline"`: thin
  Powerline caps and the label in the variant's hue, no fill. `merged`, `NEW` and
  `GONE` are events and keep their solid fill, which is now the only thing on a
  row that reads as news.

  `@kud/ink-ui` moves to 0.24.0 across every package, which is where `tone` lands.

## 0.6.0

### Minor Changes

- 29e5587: A merge conflict is not a verdict on the code, so it no longer evicts a review that was asked of you.

  The Review tab is `review-requested:@me` — GitHub stating outright that the next move is yours. `whoseMove` never reads that assertion directly, though: the standing only indexes `YOURS`, and the health token decides. So the four tokens missing from the `queued` row were four ways for GitHub's own request to become invisible, and `computeHealth` ranks two of them first and second, above everything else a PR could be carrying.

  `conflict` was the wrong one to be in that group, and the line it sat on the wrong side of is one this codebase already draws. `isFailCheck` separates a check that reached a bad verdict from one that reached none at all, because a verdict means the code was examined and found wanting. CONFLICTING is not a verdict: nothing was examined, nobody decided anything, and the ordinary cause is a third party merging something else while this PR sat still. The diff you were asked to read is the same diff after the rebase, which makes "reviewing it is wasted" — the whole claim the `queued` column makes when it declines a row — false here.

  The cost was larger than one token, because of where the ladder puts it. A conflicted PR carrying an unresolved thread addressed to you never surfaces as `threads`; `conflict` collapses it on the way past, and the row you owed a reply on was filed under Their move for a reason unconnected to the reply.

  `ci-fail`, `changes-req` and `draft` are unchanged and stay the author's. The 2026-08-26 case that put them there was real — 20 rows in the Review tab, 18 of them red builds, conflicts and drafts, interleaved with the two that could be reviewed — and reading a red build as the author's problem is what made that tab usable. That reading was an observation rather than a principle, and this is the third of it that observation did not support.

  Both ends stay pinned: `bands.test.ts` now separates the token that flips with your side of the PR from the one that does not, and the last-word guard from 2026-08-27 keeps its `authored` scope untouched.

- 1170b7d: A row can now hand its pill an explicit fill.

  The six semantic variants are the whole palette a host had, which is right while
  the pill is saying something this repo defines — accent for a heading, muted for
  a unit of work. It is wrong when the vocabulary belongs to the system being
  mirrored: an issue tracker has already assigned a hue to each of its types, and
  the reader arrives knowing them. Forcing those through two weights threw away
  information the host held and the reader wanted.

  `TaskRow.pillColor` overrides `pillVariant` when set, exactly as `Pill`'s own
  `color` prop does — the escape hatch existed one layer down and was unreachable
  from a row. The word is still drawn whatever the fill, so hue stays
  reinforcement rather than the only channel.

## 0.5.1

### Patch Changes

- Updated dependencies [aa5cded]
  - @kud/gh@0.15.0

## 0.5.0

### Minor Changes

- c20b3b9: An issue you own is your move, and `none` was always the fact that says so.

  `whoseMove` had three answers and used the third for two different absences. `undefined` means the fetch never bought the health selection, so the row could be anything — declining is the only honest reading, and it stays. `none` means something else entirely: `computeHealth` returns it for an open row with no `isDraft` to read, which is to say it has positively identified an issue. Both went to `unknown`, so the fact was thrown away with the non-fact.

  What that cost is visible the moment the cockpit is scoped to one repo. An Assigned tab there is issues end to end, so every row landed in the same band, under a header that could only ever read `Unclassified (12)` — in a band whose stated justification is that its label carries the information. Twelve rows and a heading that says nothing about any of them.

  So `none` from the `authored` standing now answers `you`. It is a reading rather than a guess, and it is the only reading available: an open issue you filed or were assigned has no review outstanding, no check that can go red, and nobody else in the room to hand it to. `queued` and `spoken` keep declining, because somebody else's issue is not yours for having been pointed at it or having replied once.

  The two absences are now tested apart, which is the part worth keeping. Collapsing them again would extend the claim to `undefined` and hand `authored` a confident verdict on a row nobody looked at — the exact wrong answer `healthOf` exists to refuse, arriving through the fix for its opposite.

## 0.4.1

### Patch Changes

- Updated dependencies [66f058d]
  - @kud/gh@0.14.0

## 0.4.0

### Minor Changes

- c391557: `whoseMove` answers `unknown` where it previously guessed, and a row may now be present without a verdict.

  Every row had to resolve to `you` or `them`, so a row that could not answer still got an answer. `YOURS[position].includes(health)` with an absent health is `includes(undefined)`, which is false — and false means `them`. It failed twice, both times in the direction that looks like nothing is wrong. Every issue carries `none`, so all 44 rows matching `assignee:@me` filed under Their move while the column counting them read 0. And the two-tier fetch a truncated source needs would have filed 79 overflow rows the same way, on the exact column that was reported missing: the complaint reproduced by its own fix.

  `Move` is now `"you" | "them" | "unknown"`, `GHItem.health` is optional, and `toGHItem` reports no health rather than inventing one. That second half is what makes the first honest: `computeHealth`'s ladder falls THROUGH an absent `reviewDecision`, `mergeable` and check rollup to `waiting`, so a row nobody looked at asserted "nothing red, nothing running, nobody has reviewed it" — which from the `queued` standing reads as Your move. The cheapest possible fetch produced the most confident possible verdict. `merged`, `closed`, `draft` and `none` are exempt, being readable off `state` and `isDraft`, which the minimal shape keeps.

  The band sorts BETWEEN the other two, not after them. The bands rank claims on the reader's attention rather than confidence in the reading, and `them` is the one band that exists to be skipped — so a row we could not rule out outranks one we ruled out. Sorting it last would have left these rows exactly where `includes(undefined)` already had them, with a type to make it look deliberate.

  It is labelled `Unclassified`, breaking the possessive pattern the other two share on purpose: a third phrase of the same shape reads as a third owner, which is precisely the misreading the band exists to prevent. `@kud/gh-ink` draws it as a muted hollow `○`, outside `healthDisplay` — `Health` is a fact about a pull request and the absence of one is a fact about the fetch, so folding it in would put it in the legend and in every exhaustive switch that has nothing to say about it.

### Patch Changes

- Updated dependencies [2d3564b]
  - @kud/gh@0.13.0

## 0.3.4

### Patch Changes

- de054f1: A single-sided tab keeps its band header instead of collapsing to a plain list.

  ```
  Mine (8)

    Their move (8)
    ── gnachman/iTerm2 ──────────
    ~ → #733  feat(compact-tabs): …
  ```

  The old rule was "one band is not a band": if every row landed on the same side, the two headers said nothing the split hadn't, so the list stood bare. That reasoning holds for the header **pair** and not for the surviving one. "Their move (8)" is the answer the tab was opened to get — nothing here is owed by you — and a bare list gives it only to a reader who already knows how the bands work and can infer it from their absence. The label is cheap to read and the inference is not.

  It also removes a shape that changes under you: a tab that showed two headers yesterday and none today, because a single row flipped sides, reads as a rendering bug rather than as the count going to zero.

  The empty side is still omitted rather than printed as `(0)` — a header naming a band with nothing in it is the ceremony the original rule was right about. Draft and Issues are single-sided by construction, so they gain exactly one line each. Done is unchanged: it is a timeline, and whose-move is a question about live work.

## 0.3.3

### Patch Changes

- Updated dependencies [a853ce5]
  - @kud/gh@0.12.3

## 0.3.2

### Patch Changes

- Updated dependencies [cd62fd9]
  - @kud/gh@0.12.2

## 0.3.1

### Patch Changes

- Updated dependencies [9dd17b8]
  - @kud/gh@0.12.1

## 0.3.0

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

### Patch Changes

- Updated dependencies [5e4b549]
  - @kud/gh@0.12.0

## 0.2.1

### Patch Changes

- 19330e4: Fix `toGHItem` throwing on any pull request that has status checks.

  The extraction moved `toGHItem` out of `@kud/gh-cockpit` but left behind the adapter that reshapes a GraphQL node into `computeHealth`'s transport-agnostic input — checks live under `statusCheckRollup.contexts.nodes`, not on the node. Every real PR produced `checks is not iterable`, which took both the terminal and web surfaces down at the first row.

  The adapter now lives beside the mapper, and `map.test.ts` feeds a realistically nested node through it. The previous suite asserted only what the package imported, never what it did, which is exactly why a green release shipped a mapper that could not map.

## 0.2.0

### Minor Changes

- b5512f9: Extract the workflow semantics into `@kud/gh-workflow`, a pure package a browser can import.

  `whoseMove`, `sortItems`, `layoutGHItems`, the filters, the row types and the GraphQL node → row mapping were spread across `gh-ink`'s 5,600-line `inbox.tsx` and `gh-cockpit`'s shared layer, entangled with Ink, `zx`, iTerm pane launching and a `mkdirSync` that ran on import. None of it was ever terminal-specific — only its address was.

  `@kud/gh` splits `fetchHealth` out of `health.ts` so the health derivation is importable without `execa`, and gains `./health` and `./inbox` subpath exports for consumers that must not pull the CLI path. The terminal surfaces re-export by name, so nothing on their public API moves.

  Purity is asserted against the built output rather than the source: in the workspace every forbidden dependency is installed, so an accidental import compiles, typechecks and only fails in a consumer's bundle.

  Note for consumers: `@kud/gh-workflow@0.1.0` was published against `@kud/gh@0.9.0`, which predates the `./health` subpath it imports, so it fails to resolve outside this workspace. `0.1.1` pins the version that actually exports it.

### Patch Changes

- Updated dependencies [b5512f9]
  - @kud/gh@0.11.0
