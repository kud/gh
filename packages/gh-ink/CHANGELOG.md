# @kud/gh-ink

## 0.26.2

### Patch Changes

- 03960d1: The loading frame fills the terminal

  It hugged a single line and then snapped open when the fetch landed, which reads
  as a redraw glitch rather than as data arriving. It now takes the same height
  budget the browse screen gives its list, so the frame is the right size from the
  first paint.

  On a cold launch this is the only thing on screen, so it is also the first
  impression the cockpit makes.

## 0.26.1

### Patch Changes

- 8ad4867: The last-word rule applies to your own PRs only

  Shipped one release ago reading `lastActor` from every position, which destroyed
  the distinction the whose-move table is built on: the mechanical blockers —
  `ci-fail`, `conflict`, `changes-req` — are yours on your PR and theirs on theirs.
  Read unconditionally, a colleague's failing build became your move the moment
  they commented on their own work. Eleven rows of other people's PRs turned up
  under Your move, which is the noise the bands exist to prevent.

  It now applies on `authored` only. The other two positions never needed it: a
  review actually wanted from you is `waiting`/`pending`, and a conversation you
  are in is `threads` — both already listed. What is deliberately not claimed is a
  plain reply on a PR you reviewed once: real, but indistinguishable from the
  author saying "rebased" to nobody in particular.

## 0.26.0

### Minor Changes

- d06a81b: The inbox knows its own API budget, and stops spending yours

  GitHub answers `rateLimit { cost remaining resetAt }` **inside** the query
  response, for free. The cockpit asked for it on every fetch and threw it away —
  so it could exhaust a 5,000-point budget without ever mentioning it, and the
  first sign was an action failing.

  The fetcher may now return that as `budget`. Given it:

  - **Automatic refreshes decline themselves** when fewer than two fetches remain.
    Launch-with-stale-cache and mutation-signal refreshes are the ones spending on
    your behalf; `r` is never gated, because a budget is a reason to stop spending
    it unasked, never a reason to refuse what you asked for. The pause is stated on
    screen — silence is indistinguishable from an inbox with nothing new.
  - **The header warns** below eight fetches, red at zero. Silent above that: a
    counter on a healthy account is noise in a header already carrying four things.
  - Priced in whole **fetches**, not points. "1,847 points" needs dividing before
    it means anything; "16 fetches left" is already the answer.

  Cached to disk (cache version 3), because the budget is shared by every instance
  and every other tool on the account — so the useful reading is the most recent
  from anywhere, and a cockpit launching cold needs it _before_ its first fetch,
  the one moment it has no response to read it from.

  Never from `GET /rate_limit`. That endpoint is served from replicas that do not
  share state: on 2026-08-27 it reported `used: 0, remaining: 5000` while GraphQL
  refused every call, and returned `used` values that _decreased_ between two reads
  one second apart.

### Patch Changes

- Updated dependencies [aa9ae55]
  - @kud/gh@0.6.0

## 0.25.0

### Minor Changes

- e0c7f1a: One signal, one fetch — however many cockpits are open

  A mutation signal wakes every running cockpit, and each paid the full query for
  the same answer. Three open cockpits turned one closed issue into three fetches,
  at 111 GraphQL points each: about fifteen signals an hour and a 5,000-point
  budget is gone.

  The cache is already shared on disk and keyed per scope, so a sibling that has
  refetched since the signal holds exactly what we would pay for. The watch path
  now adopts that instead of refetching — strictly _after_ the signal, since an
  entry written before it is stale by definition.

  Two details make it work rather than merely look right. A new `watchJitterMs`
  staggers the woken instances, or they would all check in the same millisecond,
  all miss, and all fetch — the very behaviour this replaces. A lost race degrades
  to the old behaviour, never worse. And an adopted result goes through the same
  path as a fetched one, so it still passes the manual-apply gate rather than
  reshuffling the list under you.

  `watchJitterMs` defaults to **0**: a package that adds randomness to its own
  timing makes every host's tests flaky, and how many instances you run is a thing
  only you know. Set it to comfortably more than one round trip if you keep
  several cockpits open.

  No daemon, no socket, no process to own: the file is the broker, as it already
  was for the signal itself.

### Patch Changes

- 189b758: Action failures say what went wrong, and cost less to attempt

  `✗ Unsubscribe failed` is not a message, it is a shrug — and the first time it
  mattered the reason was a spent GraphQL quota, recoverable and twenty minutes
  away, which the flash had thrown on the floor. Every action failure now names
  the cause and keeps gh's raw line on the end, so an unmapped one stays
  diagnosable. The fetch path learned this when `gh: HTTP 502` was landing under
  the frame; the actions never did.

  Unsubscribe also resolves the node id over REST rather than `gh pr view --json`,
  which is GraphQL. It was spending the scarcer of the two budgets twice for one
  action — and on the day it first failed, GraphQL was at zero while REST still
  had 4,996 of 5,000.

## 0.24.0

### Minor Changes

- 90abb23: Somebody else's last word puts the row on your side

  A PR where the other party commented last sat under **Their move** while its own
  turn arrow drew `←` and the explain panel read "X spoke last, your reply is
  owed". Two signals on one row pointing opposite ways: the arrow read
  `lastActor`, the band never did.

  Someone else having the last word now outranks every review state. It is the
  plainest claim on you there is — a question, an objection, a "can you rebase" —
  and none of it registers as a health, because a bare comment approves nothing,
  fails nothing and opens no thread.

  One direction only: you having spoken last does not hand the row over, since red
  CI on your own PR is yours whether or not you commented after it.

  `layoutGHItems` takes an optional `login` to read this. Omit it and the bands
  fall back to health and standing alone, exactly as before.

## 0.23.3

### Patch Changes

- 4295ada: A blank line between ticket groups, and one rule that draws it

  Ticket groups ran straight into each other: the last PR of one and the ticket
  line of the next sat on adjacent rows, so several small trees read as one long
  list — the grouping was in the glyphs and nowhere in the spacing. A ticket row
  now takes a blank line above it. PR rows still take none, or the tree under a
  ticket would be pulled apart by the very spacing meant to separate it from the
  next.

  Also fixes a latent overflow. The gap rule existed twice — the renderer drew it,
  `fitCount` priced it — and they already disagreed: `fitCount` charged two lines
  for headers only, while the renderer also gapped a task following a header. Any
  tab with that shape drew one line more than the window had bought, and the frame
  is sized to fill the terminal exactly, so it scrolled rather than clipped. Both
  now call `gapsAbove`.

- 48d06d8: Show a repeated ticket in full again

  A ticket heading two bands rendered its second appearance dimmed and key-only.
  Reverted: the duplication was never the confusing part, and cutting the summary
  made the second band harder to read than the repetition ever was.

  The split itself stands — a ticket with one PR needing you and another in review
  belongs in both, because the band reads each PR rather than the ticket.

## 0.23.2

### Patch Changes

- 352a7e9: Put the branch trunk above the stem it opens

  The `┬` on a parent row sat after the transit cell, two columns right of the
  `├─` / `└─` its children draw immediately after their own cursor cell. So it
  hung beside the row rather than above the branch, and read as a stray character
  before the title.

## 0.23.1

### Patch Changes

- fd2a3ca: A ticket shown twice reads as one ticket

  A ticket with one PR needing you and another in review lands in both bands. That
  is correct — the band reads each PR, not the ticket — but drawing the second
  occurrence identically to the first made one ticket look like two.

  The repeat now keeps its key, dimmed, and drops its summary, so it reads as the
  continuation it is. Identity is the row's URL and never its `key`: `key` is a
  label, and on a task surface that is not a tracker one label legitimately heads
  several unrelated rows.

## 0.23.0

### Minor Changes

- 09c027c: Stop naming the sides of the repo split

  **Breaking**: `isWorkRepo` and `includeWork` are replaced by one `origin` prop,
  and `filterByOrigin`'s `keep` argument is now `"matched"` / `"rest"` rather than
  `"work"` / `"home"`.

  ```ts
  origin={{ match: isWorkRepo, show: "matched", label: "work" }}
  ```

  The header printed the literal word `work` or `home`, and `filterByOrigin` took
  those two strings as its argument. That is one reader's two lives compiled into
  a library anyone can install: no other host has those categories, most have
  none, and the word appearing in the header was one nobody else would recognise.

  The predicate, the side and the word are all the host's now. The package knows
  only that there are two sides and which one you asked for; omit `label` and it
  shows nothing at all. `origin` omitted entirely means no split, which stays the
  ordinary case.

- e8bb5d2: A real tree, a way off a review, and a refresh that stays quiet

  **The tree actually branches.** Every indented row drew `└─`, so a parent with
  three children drew three closing corners and no trunk. Rows now draw `├─` until
  the last one, and a parent row opens its branch with `┬`. Both facts are about
  the row _below_, so the list supplies them — computed against the full section
  rather than the visible slice, or a window boundary would draw a corner wherever
  the scroll happened to cut.

  **`x` removes you as a reviewer**, on PRs where a review was actually requested
  of you. This is the answer that Unsubscribe is not: unsubscribing stops
  notifications and leaves every search matching, because `review-requested:@me`
  does not consult subscription state, so the row comes straight back. Dropping
  the request removes it at the cause. Two things can undo it and neither is a bug
  here — a CODEOWNERS rule re-requests you on the next push, and a request that
  arrived through a team cannot be withdrawn for one person.

  **A refresh over an unchanged inbox no longer asks to be applied.** `signatureOf`
  stripped `age` but not `activityAge`, and both are strings rendered from a
  timestamp — so a row that said `5m` said `6m` a minute later and the clock alone
  lit up `● new · r apply`. Every relative time is stripped now, and as a second
  guard a signature change whose diff finds nothing added, removed or moved swaps
  silently instead of asking.

## 0.22.1

### Patch Changes

- bf0b639: Your own draft is your move

  A draft you wrote landed in **Their move**, which said the opposite of what was
  true: nobody else can advance a draft, and nobody has been asked to. `draft`
  joins `YOURS.authored` — and only that position, so somebody else's draft you
  were pointed at stays theirs.

  It only looked right because a draft with red CI reads as `ci-fail`, which was
  already yours; a clean draft was the case that misfiled.

  Still sunk to the bottom of its band by `sortItems`. Yours to finish is not the
  same as yours to finish now, and a fresh draft must not outrank a PR somebody
  has genuinely been waiting a fortnight on.

## 0.22.0

### Minor Changes

- 812676e: Retire the in-app work ⇄ home toggle

  **Breaking**: `workToggle` is gone and `initialIncludeWork` is now `includeWork`.
  A host that used to pass `workToggle={cond}` with `initialIncludeWork={side}`
  passes `includeWork={cond ? side : undefined}` — `undefined` means no split at
  all, which is what a falsy `workToggle` used to mean.

  Which side you are looking at is decided when the command starts, from the
  directory it was run in. A key that flipped it afterwards could only ever put
  the inbox out of step with the scope it was launched in, with nothing on screen
  to explain the disagreement — and it made `w` a promise the scoped runs
  (`--here`, the home profile) could not keep.

  The header keeps a static `work` / `home` label where the switch used to be.
  Every row on screen depends on which side you are on, and the two inboxes look
  alike enough that dropping the word entirely would leave "where are my other
  PRs" unanswerable.

- d670704: Unsubscribe from a PR or issue, on `u`

  A row you no longer want to hear about had to be dealt with on github.com, which
  means leaving the inbox to do the one thing the inbox is for. `u` — and an
  `Unsubscribe` entry in the `↵` menu — drops your notification subscription in
  place.

  It resolves the node id when the action runs rather than carrying one on every
  row: `updateSubscription` is GraphQL-only, and widening the inbox query to serve
  a single action would cost every fetch. The state is `UNSUBSCRIBED`, never
  `IGNORED` — ignoring is sticky in a way that is hard to notice months later, and
  repo-level unwatching is a different verb this deliberately does not offer.

## 0.21.0

### Minor Changes

- 14a7ca4: Make the inbox cache TTL host-configurable, default 10 minutes

  It was a fixed 120s, chosen to bound the pathological case — thirty launches an
  hour — rather than the typical one. That inverted the cost: nobody launches
  thirty times an hour, but a reader who opens the cockpit every few minutes missed
  the cache on essentially every launch and paid the full eight-search query each
  time, which is also what draws `HTTP 502` out of the API.

  `cacheTtlMs` on `configureInbox`, defaulting to 10 minutes. That still bounds the
  pathological case comfortably — six full fetches an hour whatever the launch
  rate — while making the ordinary glance-close-glance rhythm free. Staleness is
  bounded from the other end regardless: acting on a row drops the cache entry, and
  `r` refetches on demand.

- 10473fc: Add pattern-based repo filtering

  `matchesFilter(repo, { include, exclude })` with `parsePatterns` for
  comma-separated flag values. `*` matches within one path segment and never
  across the `/`, a bare owner is sugar for all its repos, exclude is applied after
  include and wins.

  Groundwork for replacing the built-in two-way repo split, which was never a
  concept — it was two hard-coded filter presets and a `w` key, unable to express a
  third slice or the common case of having one. Its tests pin that the old split is
  reproducible as data (`include: [org/*, me/org-*]` and the same list under
  `exclude`), covering every repo between them with no overlap.

  The split itself is unchanged for now; nothing consumes this yet.

## 0.20.0

### Minor Changes

- 1ccd3fe: Move host-specific opinions out of the library into `configureInbox`

  `repoPriority` ranked one specific owner's repos first, with one specific repo
  above them; `resolveRepoPath` and the clone path read an environment variable and assumed a
  particular two-directory checkout layout; the cache claimed a directory named
  after one consuming tool. All of it compiled in, and all of it published — a
  ranking baked in at build time ranks its author's repos above its reader's, and
  one of those constants named a private repository.

  New `configureInbox({ repoPriority, profiles, checkoutDir, cacheNamespace })`,
  set once before rendering. `RepoProfile` replaces the implicit work/home split
  with any number of named slices, each optionally keeping its own checkout
  directory.

  **Every default is empty.** An unconfigured host gets flat repo ranking and no
  local-checkout resolution — never a guess at where someone keeps their code, and
  never a default that happens to suit whoever wrote it. `repoPriority` entries are
  ordered, matching an owner by trailing slash (`acme/`) or a repo exactly
  (`acme/monorepo`), so one repo can outrank the owner containing it.

## 0.19.0

### Minor Changes

- fe461c7: Rename `JiraTransition.state` to `transition`

  **Breaking.** The field is passed verbatim to `jira issue move`, which matches
  `t.name.toLowerCase() === wanted` — transition names, never destination
  statuses, and the two are routinely different strings. Calling it `state`
  invited passing a status, which matches no transition, so the move silently does
  nothing and the row does not budge. No error, no output, nothing to grep.

  That is not hypothetical: cockpit shipped `{ label: "UAT", state: "UAT" }`
  against an ACC workflow whose transition is named "Ready for QA" and whose
  status is "In Testing (QA)". There is no "UAT" anywhere in it.

  Rename the field at each call site; the value was always meant to be the
  transition name, so nothing else changes.

## 0.18.0

### Minor Changes

- 84604c6: Let a row carry its own whose-move standing

  `GHItem.standing` ("authored" | "queued" | "spoken") now overrides the per-tab
  inference in `whoseMove`, so one tab can hold rows from two searches and still
  band each correctly. That is what lets a host fold "review asked of you" and
  "you already reviewed" into a single tab: the two differ only in whether the ball
  comes back, which is a fact about the search a row arrived from and never about
  the PR.

  `whoseMove` takes the standing as an optional third argument; leaving it unset
  keeps the existing tab-derived behaviour. `Standing` is exported.

### Patch Changes

- 1f680d9: Recognise a folded `mine` tab as an authored standing

  A host that merges its own open PRs and drafts into one tab — the split says
  draft-ness twice, since the band already sinks a draft — would otherwise fall
  through to the `queued` default and band every row backwards. `open` and `draft`
  keep working unchanged.

- b38f3d5: Fix the whose-move band on the Reviewed tab

  `reviewed` was classified as an ordinary reviewer tab, so "awaiting review",
  "checks running" and "approved" all landed under **Your move** there. Its search
  is `reviewed-by:@me -author:@me -review-requested:@me` — that last exclusion means
  GitHub is provably not waiting on you, and a PR you reviewed that gets
  re-requested leaves the tab for `review`. The band was claiming work that was
  certainly somebody else's.

  `whoseMove` now reads three standings rather than two — `authored`, `queued` and
  `spoken` — and on `spoken` only `threads` (your reply is owed) is yours. An
  unrecognised tab defaults to `queued`.

## 0.17.0

### Minor Changes

- e4dbd10: Split each inbox tab into "Your move" / "Their move" bands

  A tab already says which relationship you are looking at — it never said whether
  there was anything to do once you got there, so red CI, merge conflicts and
  drafts sat interleaved with the rows you could actually act on.

  `layoutGHItems` now splits every tab but Done into two whose-move bands, each
  keeping its own repo grouping. The band is decided by health AND tab together:
  `✗` on a PR you wrote is yours, the same `✗` on one you were asked to review is
  the author's. `threads` and `approved` are yours from either side. A tab whose
  rows all land on the same side (Draft, Issues) keeps the plain list.

  Exports `whoseMove(health, sectionId)` for hosts that want the same split.

## 0.16.4

### Patch Changes

- babb7f7: Sink draft PRs below open rows within their repo group. A draft is not asking for review, so it no longer leads a Review or Incoming list on recency alone — most visibly a PR that had you requested and was then converted back to draft. Sunk rather than filtered: the row stays visible with its `~` glyph.

## 0.16.3

### Patch Changes

- a8b34ce: Inbox: the unresolved-threads badge now follows the turn arrow — grey and unbold once you spoke last, bold orange only while the other side is owed a reply. GitHub keeps a review thread open until someone resolves it, so replying never moved the count and the row read "your turn" in orange one column from the arrow reading "not your turn" in grey.

## 0.16.2

### Patch Changes

- 64abc24: Legend no longer gets topped on a short terminal. It now shows a window of itself with the column heading reprinted above the slice, `↑↓` / page keys to move through it, and a `n–m of total` counter; the tab-count footnote gives up its rows while scrolling.

## 0.16.1

### Patch Changes

- b876da7: Hold the transit and merge markers longer — GONE, UPDATED and NEW now sit for 7s and a merged row sparkles for 5s, so a change that lands while you are reading something else survives being noticed.

## 0.16.0

### Minor Changes

- 505607b: Mark tabs still holding unread transit news with a `●`. The hold now waits for a tab to be displayed, which left nothing to say which tab was waiting; the marker is reserved on every tab while any tab wears one, so the bar does not shift each time a tab is read.
- 84ef5b4: Give task rows the refresh vocabulary GitHub rows already had.

  `ItemRow`'s task branch returned before ever reaching the transient rendering,
  so a surface built entirely from task rows — `life`, which is Todoist and
  Notion — applied a refresh in total silence: the list changed and nothing on
  screen admitted it. The diff already computed the marks; only the renderer
  dropped them.

  A row arriving now coalesces, a row leaving dissolves, and either way it says
  NEW / GONE / UPDATED in words. The glyph gets a fixed cell of its own, present
  even when empty, for the same reason the GitHub row puts it in the health cell:
  every key and title on screen is aligned off that column, so a marker that
  appeared and vanished would shift the very row being watched.

## 0.15.0

### Minor Changes

- 79616e5: Spend the transit hold per tab, not on a global clock. A row that arrived, changed or left in a tab you were not looking at used to run out its 2.5s behind your back, so switching over showed you a list that had already settled. The marker now waits for its own tab to be displayed, and unseen marks survive the next refresh instead of being cancelled by it.

### Patch Changes

- a37b400: Bump `CACHE_VERSION` for the `jira` → `task` row rename.

  The rename changed `Section`'s shape, which is exactly what `CACHE_VERSION`
  exists to guard, and the previous release did not bump it. A v1 cache full of
  `kind: "jira"` rows deserialised into a build with no branch for them, so every
  row fell through to the GitHub renderer and crashed on
  `healthDisplay[item.health]` — a full-screen React error on launch, cleared only
  once the background refetch landed underneath it.

  Costs one cold fetch on upgrade, which is the documented price of a version bump.

## 0.14.0

### Minor Changes

- e3624a0: Rename the `jira` row kind to `task`, and make the Jira behaviour opt-in.

  The row was named after its first caller, not after what it is: a keyed,
  two-column row. `life` reuses it to render Todoist tasks, and inherited every
  Jira affordance along with the layout — ↵ opened a menu led by "View ticket",
  which ran `jira issue view` on whatever sat in `key`. In `life` that is a padded
  Todoist project name, on a surface that has never touched Jira.

  `kind: "jira"` is now `kind: "task"`, `JiraRow` is `TaskRow`, and `jiraStatus`
  is `status`. A new optional `ticket` field carries the Jira issue key when one
  exists; its presence is what turns on the drill and the `t` transitions, and the
  `jira` commands now read the key from it rather than from `key`. A row without a
  `ticket` opens its URL on ↵ and never shells out to `jira`.

  Breaking for callers constructing these rows — rename the three fields.

## 0.13.0

### Minor Changes

- 04138cc: Add an optional `note` to `JiraRow`, rendered dim after the summary.

  For a secondary annotation on a row — a recurrence marker, a source hint —
  without concatenating it into `summary`. Its own node so it can be dimmed, and
  so its width is subtracted from the title budget rather than smuggled past the
  truncation maths: a suffix hidden inside `summary` is cut off exactly when the
  row is long enough to need it.

## 0.12.0

### Minor Changes

- 0fc3007: Say what a refresh did, and let something else ask for one.

  Applying a refresh used to swap one list for another and leave you to spot the difference against a frame the terminal had already scrolled away — the reason the manual `r` gate felt like a cost rather than a control. Now the indicator counts what is waiting (`● 2 new · 1 gone · 3 moved · r apply`), and applying marks each row that moved with `NEW` / `GONE` / `UPDATED` for a short hold, with departing rows still drawn where they actually were. Words and shapes, never colour alone.

  Adds an optional `watchPath`: a stamp file that something else touches when it has changed GitHub on your behalf. Touching it makes the inbox refetch in the background — it never repaints on its own, so the apply stays yours.

## 0.11.1

### Patch Changes

- bc5459b: Stop the inbox frame jumping a row when a scrolled list starts on a repo header. The gap above a header was decided on the absolute row index while `fitCount` prices the window's first row at one line, so the list drew one row more than its budget — and since the frame is sized to fill the terminal exactly, that overflow scrolled the whole panel instead of clipping.

## 0.11.0

### Minor Changes

- fabc8cb: A merged PR now says so before it goes. Merging from the drill view returns you to the list, sparkles the row with a `MERGED` label for three seconds, then drops it. Before, the row sat there until some later refresh removed it, so the one action that finishes a piece of work was the only one with no acknowledgement.

  `DetailContext` gains an optional `onMerged`, and `HealthPanel` an optional `onMerged` prop. Both are optional: a host that wires neither keeps the previous behaviour, including the post-merge reload.

## 0.10.0

### Minor Changes

- 0ac0503: Order rows by last activity within each repo, and show both dates

  `sortItems` had no time component at all — repo priority, then repo name, then
  whatever order GitHub's search happened to return. Two open PRs on the same repo
  could sit in any order, so a thread someone had just replied to rendered below a
  quieter one opened more recently.

  Recency now breaks the tie **within** a repo. The grouping is untouched: repo
  priority and repo name stay the outer keys, so `insertRepoHeaders` still emits
  one header per repo and no repo is scattered down the list.

  `GHItem` gains an optional `activityAge`, rendered beside `age` as `3h · 2d` —
  active 3h ago, open for 2d. It collapses to a single value when the two agree,
  so an untouched row does not read `2d · 2d`. What counts as activity is the
  surface's decision; this layer only renders what it is handed.

## 0.9.1

### Patch Changes

- ed3aa1e: Render the empty and failed states instead of printing them and exiting.

  A first fetch that came back with nothing, or that threw, used to `console.log`
  / `console.error` and `process.exit`. Hosts mount this App under Ink's
  `alternateScreen`, which restores the primary buffer on teardown without
  replaying anything written to the alternate one — so the message went into a
  buffer that was immediately discarded and the user was left staring at a blank
  terminal, unable to tell "nothing is open" from "the fetch died" from "the scope
  resolved somewhere I did not mean".

  Both are now states rendered inside the usual frame, so the header still names
  what was looked at, with `r` to retry and `q` to quit. Hosts can pass
  `emptyHint` to say what came back empty in their own vocabulary.

## 0.9.0

### Minor Changes

- fcd8a26: Overlays now float over the browse list instead of replacing it. Pressing `?`, `m`,
  `f` or `e` used to blank the screen and show the panel alone; the list stays put
  underneath, dimmed, so the panel reads as a modal over the app rather than as a
  different screen. The panel is opaque (a background, since Ink leaves an unpainted
  Box transparent) and sits in normal flow with the backdrop lifted out, so one taller
  than the list area grows the row rather than being centre-clipped.

## 0.8.1

### Patch Changes

- 5c867a0: Fix the `?` legend coming apart on terminals narrower than ~118 columns. The three
  legend columns were laid out at a fixed width with no fallback, so Ink wrapped every
  row mid-word and the modal's border fell out of step. The modal now reads the live
  terminal width and falls down a ladder of layouts — three columns across, then Status
  and Tabs stacked beside Keys, then a single column — and the cell gutter is derived
  from the widest cell rather than hardcoded per column.

## 0.8.0

### Minor Changes

- 7be0454: Gate the glance's launch fetch behind a 120s TTL, and drop the cache when an action lands.

  The disk cache already existed: launch painted from it, then called `revalidate()` **unconditionally**. So it bought a fast first frame and saved nothing — every launch spent the inbox query's **111 GraphQL points** against a 5000/hour account-wide pool, however recently the last launch ran. A cache that records rather than prevents; the store was there, the freshness policy was not.

  Now a cached glance younger than the TTL launches without fetching. `r` still refetches on demand, so nothing strands you on stale rows.

  Two things that only matter once an entry is _trusted_ rather than immediately overwritten:

  - **Cache files carry a version.** `readCache` validated only that `sections` was an array, so a file written by an older `Section` shape would have deserialised into new code and rendered wrong. An unrecognised version is a miss, costing one cold fetch on upgrade.
  - **An action drops the entry synchronously.** Handlers schedule their refresh behind a 1500ms delay to let GitHub settle; quitting inside that window used to leave pre-action rows on disk. Harmless when every launch refetched — a visible wrong answer once the TTL trusts them. The delay now lives with the invalidation rather than being repeated at each call site.

  120s bounds the pathological case rather than the typical one: nobody launches thirty times an hour, but at 120s even that ceiling stays inside budget, and "nobody does that" is precisely what was believed about the process that exhausted this pool.

### Patch Changes

- Updated dependencies [7be0454]
  - @kud/gh@0.5.1

## 0.7.1

### Patch Changes

- Updated dependencies [37586f4]
  - @kud/gh@0.5.0

## 0.7.0

### Minor Changes

- 9fcc195: Trim the inbox footer strip to six orientation hints (nav, tab, open, actions, help, quit). Extension hints are no longer injected into it, so the strip keeps a fixed width no matter how many extensions a host registers — previously every extension widened it until it wrapped onto a second line. Every key stays bound and every one of them is still listed in the `?` legend.

## 0.6.0

### Minor Changes

- Surface a failed background refresh in the flash instead of swallowing it.

  Once something is on screen, a rejected `fetcher()` was caught and dropped: the list kept rendering from cache with no hint it had gone stale, and the only thing a user saw was whatever the fetcher's child process leaked to stderr — outside the Ink frame, where nothing can lay it out.

  `BrowseScreen` takes an optional `refreshError`, flashed inside the border like every other transient outcome. It carries a timestamp so two identical failures in a row are two distinct values; a bare string would compare equal and fire only once, reading as a recovery.

## 0.5.3

### Patch Changes

- Updated dependencies
  - @kud/gh@0.4.1

## 0.5.2

### Patch Changes

- Updated dependencies [67c40eb]
  - @kud/gh@0.4.0

## 0.5.1

### Patch Changes

- Updated dependencies [1bdf706]
  - @kud/gh@0.3.0

## 0.5.0

### Minor Changes

- cd60c53: Make extensions discoverable, not just dispatchable. 0.4.0 honoured `InboxExtension.key` generically but left every surface that _advertises_ a key naming Jenkins by hand, so a second extension worked and was invisible: no footer hint, no line in the `?` legend, and no entry in a row's action menu.

  All three now derive from the `extensions` array:

  - The footer strip takes each extension's new optional `hint` (short, columns are scarce), falling back to a lowercased `title`.
  - The `?` legend takes `title` spelled out. `HelpModal` receives `extensions` instead of a `hasCi` boolean — a flag could only ever say "Jenkins exists", which is precisely why a second extension went unlisted.
  - `buildActions` accepts a trailing `{ extensions, onOpenExt }` bag and appends an entry per **item-scoped** extension, so delegation appears under `m` where you would look for it.

  New optional `scope: "item" | "global"` on `InboxExtension` distinguishes an extension that acts on the selected row from one that is host-wide. It defaults to `global`, making the action-menu listing opt-in: a host that has not thought about scope does not get Jenkins offered as something to do _to_ a pull request.

  **Not breaking.** `hint` and `scope` are optional, and `buildActions`' new parameter is a trailing optional. An existing extension keeps working; it simply stays out of row action menus until it declares `scope: "item"`.

## 0.4.0

### Minor Changes

- 2779c4c: Make `InboxExtension.key` a real binding. `BrowseScreen` now receives the `extensions` array and dispatches on each extension's declared `key`, replacing a hardcoded `input === "J"` arm that could only ever open Jenkins — so a second extension could declare a key and nothing would read it.

  `ExtensionTarget` replaces the bare `string` that `body` received. It carries `{ item?: AnyItem; ciJob?: string; login: string }`, so a row-scoped extension gets the selected row (which no string could carry) while Jenkins keeps reading its job name. Both contexts travel together rather than being chosen by inspecting the extension's id, which would make `key` decorative again. `login` rides along because extensions are declared at module scope, before the viewer has been fetched, so a body cannot close over it.

  Extensions are matched below every built-in binding, so a declared key cannot shadow navigation, refresh or quit, and above the active-row guard, so a domain-scoped extension still opens on an empty tab.

  **Breaking for extension authors:** `body(onExit, target)` now receives `ExtensionTarget | undefined` instead of `string | undefined`. A Jenkins-style extension reads `target?.ciJob` where it previously used `target`.

### Patch Changes

- 2779c4c: Stop child-process output painting outside the Ink frame. Closing an issue or PR, or moving a Jira ticket, briefly printed a stray confirmation line outside the inbox border.

  zx captures a child's stdout but passes its **stderr** straight to the terminal, and `gh`/`jira` print status lines like `✓ Closed issue #42` there so stdout stays pipeable. Ink owns a region of stdout and repaints it; it has no view of stderr, so that line landed raw at the cursor, outside the frame, until the next render scrolled it away — a duplicate of a message the inbox was already rendering properly through `showFlash`.

  All eleven child-process calls in the inbox now run through a single quiet wrapper, `open`'s failure text included.

## 0.3.1

### Patch Changes

- abb024f: Move the repo picker's cursor onto `useListCursor` from `@kud/ink-ui`, replacing the local `useState` and its two arrow-key handlers. `vimKeys` is off and the hook is gated on `repoPicker`, so the keymap is unchanged.

  The main tree keeps its own handlers on purpose — its cursor steps through `moveCursor`, which skips header rows, so the hook's ±1 would land on one. Both decisions are now noted at their call sites.

- c5ad810: Keep the tab you are on when the work ⇄ home switch flips. `filterByOrigin` drops sections that end up empty, so the two sides expose different section sets — following the tab index handed you a different tab, and on Done it was reliably the wrong one.

  `w` now resolves the active section by id and only falls back to the clamp when that tab has no counterpart at all. `cursors` and `viewStarts` moved from position-keyed arrays to records keyed by section id for the same reason: landing on the right tab was not enough while the saved row still came from whichever section used to sit at that index.

## 0.3.0

### Minor Changes

- 04ffe69: Add the inbox shell — the browse screen, action menu, layout, navigation and `App` extracted from ambre's cockpit, so a second surface can have the same interface with different queries.

  Host-supplied where the shell used to assume its first host: `detailFor` (the drill-in view, on the same seam as `extensions`), `title` (the header brand, loading line and empty message), and `isWorkRepo` / `initialIncludeWork` (the work ⇄ home split). The duplicated `Health` union and its display tables are gone in favour of `@kud/gh` and this package's own `health-display`.

## 0.2.0

### Minor Changes

- f476456: `HealthPanel` only spaces a summary row from the list above it when that list has entries. On a PR with no checks and no reviewers, Checks / Reviews / Merge previously rendered with a blank line between each, spacing rows apart from nothing.

  `CommentsPanel` gains `showConversationHeading` (default `true`). Hosts that already name the section — cockpit puts the payload behind a "Conversation" tab — can turn off the panel's own heading instead of stacking the same word twice. The "Review threads" heading is unaffected, since it separates two genuinely different lists.

  The empty state no longer says "on this PR": the panel now also renders issue conversations, which have no review threads.

### Patch Changes

- Updated dependencies [f476456]
  - @kud/gh@0.2.0
