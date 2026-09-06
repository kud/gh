# @kud/gh-ink

## 0.45.0

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
  - @kud/gh-workflow@0.3.0

## 0.44.5

### Patch Changes

- b18d54a: The tab pulse settles after a minute instead of running for as long as the process is up.

  Every other hold in the inbox is bounded by a timer. The tab pulse was not, and could not be, because it is gated on `markedTabs` — and a mark on a tab nobody has opened deliberately never expires. That promise is the point and it is unchanged: unread news still keeps its marker for as long as it takes you to come and collect it.

  What had no bound was the **ticker**, and nothing about the code said so. It used to be scoped to the rows the visible tab draws, which left an untouched tab with the ticker stopped. Moving the marker to the tab bar widened the gate to "any marked tab" — correctly, since a marker you cannot see is the whole case the pulse exists for — but the gate's other end still had no ceiling, and the comment above the interval was left behind still claiming the old scope. It said the opposite of what the code did, which is how this survived review. Making the dot breathe at 150ms rather than 450ms then tripled the cost of the same loop.

  Together: one uncollected mark on one tab re-rendered the entire inbox 6.7 times a second, for the lifetime of the process. Measured 2026-09-06 on a cockpit left open 22 hours — 4.15 GB resident and still climbing at roughly 1.4 GB/min, on a host that was down to 10 MB of free RAM with its swap full and its CPU thermally throttled to 46%. The sibling running `--here` on the same machine, up two days with no marked tabs, sat at 13 MB throughout.

  `PULSE_SETTLE_MS` now stops the ticker after 60 seconds and rests the marker on `◉`, the widest frame in the cycle. Sixty seconds is chosen against the eye rather than the machine: a pulse nobody has looked at in a minute will not be noticed by pulsing for an hour. Resting on the widest frame is the half that keeps the feature — five of the six frames are narrower and one is a bare `·` that reads as no marker at all, so stopping on wherever the ticker happened to be would have quietly deleted the mark it was protecting.

  The ceiling is keyed to what is being pulsed about rather than to the boolean, so news arriving on a second tab while the first is still marked buys its own minute instead of inheriting a spent one. It is also eight times the longest row hold, so no sparkle or transit animation can be cut short by it — the ceiling only ever ends the open-ended tab case.

## 0.44.4

### Patch Changes

- Updated dependencies [19330e4]
  - @kud/gh-workflow@0.2.1

## 0.44.3

### Patch Changes

- 9e67e56: The tab marker breathes at 150ms instead of 450ms, and stops snapping.

  The dot on a tab holding unread news ran a four-frame sawtooth — `· ○ ◎ ◉`, then straight back to `·` — one frame every 450ms, so a full breath took 1.8 seconds. Beside a 7-second hold that reads as a marker someone forgot to switch off rather than one asking to be collected.

  It took that rate from the row transit marks, which share the same ticker through a divisor, and the reasoning behind the divisor was sound but aimed at the wrong axis. What it protects against is motion sitting **beside text you are reading**: a row mark strobing three times a second in the reading line is an interruption, not a marker, and that is still true and still unchanged. The tab marker is not in the reading line. It lives in the peripheral bar, where vision is motion-sensitive and text-blind — which is the entire reason the pulse was put up there. Nothing is being read next to it, so there is nothing for it to interrupt. The split had been made by animation when the thing that actually differs is where on the screen it lands.

  The shape moves with the tempo, and the shape was doing more of the damage. `◉` snapping back to `·` is a discontinuity, and a discontinuity read at speed is a blink — at 150ms the old ramp would have flashed once a second, which is a smoke alarm rather than a pulse. The ramp now runs out and back, `· ○ ◎ ◉ ◎ ○`, so every step is one ring's change in the same direction and the dot swells rather than restarting. Six frames at 150ms is a 900ms breath.

  The row ramps keep their sawtooth deliberately. `TRANSIT_OUT_FRAMES` dissolving and `TRANSIT_IN_FRAMES` coalescing is directional information — a row that thinned to a dot and filled back in would be claiming it left and returned. The two shapes now differ because they mean different things, which is a better vocabulary than the one where they matched. The merge sparkle is untouched: it was already out-and-back through `✧`, and 150ms is what makes it read as a twinkle.

  Taking the ticker undivided also puts the tab pulse back in phase with the sparkle, which is what the one shared ticker existed to guarantee in the first place.

- b5512f9: Extract the workflow semantics into `@kud/gh-workflow`, a pure package a browser can import.

  `whoseMove`, `sortItems`, `layoutGHItems`, the filters, the row types and the GraphQL node → row mapping were spread across `gh-ink`'s 5,600-line `inbox.tsx` and `gh-cockpit`'s shared layer, entangled with Ink, `zx`, iTerm pane launching and a `mkdirSync` that ran on import. None of it was ever terminal-specific — only its address was.

  `@kud/gh` splits `fetchHealth` out of `health.ts` so the health derivation is importable without `execa`, and gains `./health` and `./inbox` subpath exports for consumers that must not pull the CLI path. The terminal surfaces re-export by name, so nothing on their public API moves.

  Purity is asserted against the built output rather than the source: in the workspace every forbidden dependency is installed, so an accidental import compiles, typechecks and only fails in a consumer's bundle.

  Note for consumers: `@kud/gh-workflow@0.1.0` was published against `@kud/gh@0.9.0`, which predates the `./health` subpath it imports, so it fails to resolve outside this workspace. `0.1.1` pins the version that actually exports it.

- Updated dependencies [b5512f9]
  - @kud/gh-workflow@0.2.0
  - @kud/gh@0.11.0

## 0.44.2

### Patch Changes

- 089678d: The list actually recedes behind an overlay now. It was already meant to — the backdrop set `dimColor` on every `Text` in the subtree — and the mechanism did not survive contact with a terminal. SGR 2 is a single binary attribute whose meaning the terminal decides, and on iTerm2 it barely moves a 24-bit foreground: dumping the escape codes for one row either side of the overlay gave the same `38;2;255;135;0` orange both times. The panel had a modal over a list that was still shouting, and there was no "more dim" available to apply.

  So the backdrop **replaces** the colour rather than attenuating it, and drops faint on the way out. Both together would be worse than either — a flat colour with SGR 2 still on hands the result back to whatever this terminal does with faint, which is the failure being fixed one layer along.

  Two planes, not one, because a single tone collapses the list to a mat and the point of a backdrop is that something structured is behind the panel. `dimColor` at the call site is reused as the plane selector rather than re-encoded: every element that had already declared itself furniture — prefixes, repo, age, author — says so again, one step further back. Not one call site changed, which is the same trick as the original shadow, one turn further.

  The health glyphs and the turn arrows lose their hues while an overlay is up, and that is `health-display.ts`'s contract being spent rather than broken: the glyph distinguishes the state and colour only ever reinforced it, every one of those glyphs passes a silhouette test, and nobody diagnoses a PR through the list behind a dialog they are operating. It returns with the next frame.

  Pills stop being drawn behind an overlay. `Pill` is `@kud/ink-ui`'s and renders that package's `Text`, so it cannot see the context and keeps its fill — harmless while the backdrop merely lost its bold, and the loudest cell on screen once everything around it flattens. A pill is an announcement and there is nobody to announce to. Its width is still charged, so no row reflows as the panel opens over it.

  `backdropStyle` is exported so the decision can be pinned without rendering: chalk emits colour only when the runner is a TTY, so a spec grepping a frame for escape codes would pass vacuously wherever the suite is piped.

## 0.44.1

### Patch Changes

- a634508: An overlay no longer takes the list down with it. Opening the actions menu on a cockpit with no rail showing truncated every row behind it to about a dozen columns, spilled the remains outside the frame, and put the panel hard against the left edge instead of the middle — all four overlays, one code path.

  The list column was sized `showRail ? listCols : undefined`, applying the rail ternary a second time after `listCols` had already answered it, and withholding the width in exactly the case where `listCols` is `COLS` and correct. With no width and an overlay up, the column's only in-flow child is the panel — the list sits in an absolutely-positioned backdrop and contributes nothing to its parent's intrinsic size — so the column measured itself against the panel. `width="100%"` on the backdrop then resolved to the panel's width rather than the list's, and `alignItems="center"` centred the panel inside a box that WAS the panel. Two symptoms, one missing number.

  The general shape is worth carrying out of here: an absolutely-positioned child pays nothing towards its parent's size, so a percentage width inside it measures whatever the in-flow siblings happen to be. A layout can look obviously right and still have no width to resolve against.

  `HelpModal` is why this survived three existing overlay tests. It is nearly as wide as the frame, so a column collapsed to the panel is close enough to a column sized to the list that both "rows still visible" and "opaque over rows" held. The two new tests press `m` instead: `ActionMenu` is the narrowest of the four, and it measures the row's own content extent rather than the line length, since the frame's border pads every line to the terminal's width whatever the row did.

- 8be6855: `@kud/ink-ui@0.22.0`, which takes the sliding underline off the tab bar. The rule lands under the active tab on the frame the tab changes, and the highlight lands with it — no travel, no lead-and-follow.

  It reaches the cockpit through this bump rather than through anything here, and it is worth a line because the tab bar is the one component drawn across the top of every screen: a half-tuned animation there is the first thing the eye goes to and the last thing that should be asking for attention. The slide was three releases of tuning that had not converged, so it was parked whole on `feat/tabs-underline-animation` upstream — step count, ease shape and the lead/follow split intact — to be finished rather than rewritten. Tab markers are untouched.

  All six packages move together, which is the invariant this repo now states outright: a second copy of the component library in one process is a module-level singleton configured in one instance and read from the other.

## 0.44.0

### Minor Changes

- 21cc38e: Rows say what KIND of thing they are, not only what state it is in. Health had eleven states, a glyph each and a legend on `?`; labels had nothing at all, so a `plan`-labelled issue and an ordinary one were indistinguishable in the list — on a cockpit whose whole worklist _is_ `plan`-labelled issues. The data was already being fetched and thrown away: `@kud/gh`'s inbox query has carried `labels(first: 10)` in `full` mode all along, under a comment reading "Nothing here renders labels."

  At most two per row, chosen against the host's new `labelPriority` — an ordered list where an entry ending in `*` matches by prefix, so `app:*` need not be enumerated — and by name after that. The cap is the design rather than a concession to width: a row showing every label has stopped being a row. `labelPriority` is empty in the library like every other default here, and that is load-bearing rather than tidy — `plan` and `app:*` are one reader's filing conventions, and a library that shipped them would be ranking a stranger's labels by a scheme they have never seen.

  Alphabetical was the obvious ordering and it is wrong on the exact case this exists for: on a repo where every issue carries `plan` plus `app:<name>`, `app:cockpit` sorts first and the label saying what KIND of thing the row is gets dropped. That is the ranking's whole job.

  The cell sits immediately after the title rather than out with the trailing furniture, because a label is read as part of the subject rather than scanned down a column. One tag glyph then the names, dim, verbatim casing, no per-label colour — GitHub's label hues are authored in a repo that knows nothing of this palette, and it would be the one place on the row where colour alone did the discriminating, which is the failure `health-display.ts` exists to prevent. There is no `+2` overflow marker: it would spend three columns to say something you cannot act on, on precisely the rows whose titles are already the most squeezed.

  It takes **two** rungs on the row's give-up ladder rather than one, degrading two labels → one → none, because the second label is the most speculative thing on the row and the first is what the row _is_. The repo still outlives both: on a nested row the repo is positional — it says the row is not where the header above it claims — so dropping it misattributes the row, where a dropped label is only less to go on.

  `GHItem` gains `labels`, and `CockpitItem` — which existed solely to widen `GHItem` with it — collapses to an alias.

## 0.43.3

### Patch Changes

- 0f9e7ae: Takes `@kud/ink-ui` 0.21.0: a tab lights when the underline arrives, not before.

  The rule leads and the text follows. Throughout the slide the tab you came from
  keeps its highlight, and the destination takes it at the moment the rule lands
  underneath — so exactly one thing is moving, which is the only way the eye can
  follow it.

## 0.43.2

### Patch Changes

- 608e7db: Takes `@kud/ink-ui` 0.20.2, which removes the last two jumps from the tab rule.

  The rule's length flickered a column wider and back on alternate frames as it
  travelled — its edges were rounded independently — and the tab label lit up the
  instant `active` changed, so for the length of the slide the destination was
  already bold while the rule was still crossing towards it. The highlight now
  travels with the rule.

## 0.43.1

### Patch Changes

- 154daf6: Takes `@kud/ink-ui` 0.20.1, where the tab underline slides rather than jumping.

  The rule travelled as of 0.20.0 but read as a jump followed by a bubble: its
  steps landed faster than the terminal repaints, so several coalesced, and it
  eased out only — which starts at full speed and put most of the distance in the
  first visible frame. It now eases in and out over twelve steps at 28ms, roughly
  one step per repaint.

## 0.43.0

### Minor Changes

- 07dd4f5: `merged` and `closed` get glyphs that mean something, and the tab rule slides.

  **The two arbitrary health glyphs are gone.** `»` for merged and `×` for closed
  were chosen to be distinguishable rather than to be read: `✓` and `✗` you never
  have to think about, `»` you did. They are now Nerd Font's git-merge and
  closed-pull-request icons. `×` had a second problem beyond being arbitrary — it
  is one stroke from `✗` (ci failing) two rows up in the same map, and the
  shape-distinctness this file turns on is a silhouette test, not a codepoint one.

  The cost, stated rather than discovered: a terminal without a Nerd Font draws a
  box where it used to draw a chevron. That trade was already made once here — the
  inbox hardcodes the comment glyph — and two states degrading to tofu is cheaper
  than ten states none of which say what they mean.

  A new spec pins every glyph to a single column. That cell sits in the aligned
  zone left of the title and every key on screen lines up off it, so a two-column
  glyph shifts only the rows carrying one — the exact failure a fixed cell exists
  to prevent, and no longer hypothetical now that glyphs are chosen for meaning
  rather than for width.

  **Requires `@kud/ink-ui` 0.20.0**, which brings the sliding tab rule: the active
  tab's underline travels between tabs rather than blinking from one to the next,
  stretching as it goes when the destination is wider.

## 0.42.1

### Patch Changes

- c426058: Row markers are lower case: `merged`, `gone`.

  The capitals were doing a job back when these were bare coloured words competing
  with a line of dim metadata for attention. A fill does that job now, and once it
  does, shouting on top of it is just shouting. `epic` and `merged` sitting on the
  same row in the same register is the point — they are the same KIND of thing, a
  word about the row rather than another of its attributes.

  One cost, worth naming because it caught two specs: lower case gives up the
  uniqueness the capitals had. `merged` and `gone` are ordinary words that turn up
  in titles — the merge spec's own fixture is called "the pull request being
  merged" — so an assertion on the bare word now matches prose. Anything checking
  for a marker matches the pill, caps included, rather than the word.

## 0.42.0

### Minor Changes

- cbcbd71: The refresh marker moves to the tab bar and the header, and stops strobing.

  Three things were wrong with announcing a refresh on the rows themselves.

  **It moved the row.** The trailing word sat inside the title's width budget, so a
  row that gained one paid for it by shedding its repo name or squeezing its
  summary — reflowing at the exact moment you were reading it. The glyph column
  solved this years ago by reserving a cell whether or not it is occupied; the word
  never got the same treatment. It is gone from both row kinds now. What stays is
  free: the glyph in its reserved cell, bold for a row arriving, dim and struck
  through for one leaving — which is also the pair that distinguishes the two
  without reading a word.

  **It reported news you could not see.** A marker on a row inside a tab you are
  not looking at is invisible by construction, and that is the case the hold exists
  for. The tab marker is now animated, pulsing through the same ramp the rows
  dissolve along, so the bar says where. The cell is two columns on EVERY tab,
  always — it used to collapse when the board was quiet, sliding the whole bar
  sideways twice per refresh, and a bar that shifts is one you have to re-find.

  **It said it too fast.** The transit frames shared the merge sparkle's 150ms.
  That rate is right for a 2.5-second celebration of something you just did and
  wrong for a 7-second notice about something that happened elsewhere: six blinks a
  second beside text you are trying to read is an interruption, not a marker.
  Transit frames now advance a third as often, off the same counter, so the two
  animations still cannot drift.

  The wording — `1 new · 1 gone · 1 moved` — lives in the header for the length of
  the hold, in the same words the pending indicator used a keypress earlier. That
  segment is the one place on screen where a changing width costs nothing: a dashed
  filler absorbs the difference and nothing is aligned to its right.

  `GONE` and `MERGED` still appear on the row itself, and the distinction is who
  caused it. Those follow a key you pressed a second ago, on a row you are looking
  at and which is leaving anyway, so the acknowledgement is the whole point and its
  reflow is both expected and brief.

  `tabLabel` is deprecated in favour of `tabMarker` plus `Tabs`' own `marker` field.
  Requires `@kud/ink-ui` 0.19.0.

## 0.41.0

### Minor Changes

- 9caaa21: A row's refresh marker is a pill, not more trailing text.

  `NEW`, `GONE`, `UPDATED`, `MOVED` and `MERGED` are drawn through
  `@kud/ink-ui`'s `Pill` in their existing colours, on both the ticket row and the
  PR row. Nothing about the vocabulary changes: they are still words rather than
  hues, because a marker that lives only in the colour is a marker a colourblind
  reader does not have, and `NO_COLOR` degrades the pill to `[GONE]` rather than
  to nothing.

  What changes is the shape, and the shape was the bug. These markers sit at the
  end of the row, immediately after the dim age, author and repo cells — so as
  plain coloured text they read as one more column of trailing metadata. That is
  the opposite of what they are: every other cell on the row is state you may
  skip, while these are the one thing on screen reporting work that happened in
  another window, and `TRANSIT_HOLD_MS` exists precisely so they survive being
  NOTICED rather than merely seen. A fill is what makes them read as an
  announcement about the row instead of another of its attributes.

  Both width budgets charge for the caps — `pillWidth` on the ticket row, an
  explicit term on the PR row. Pricing a pill by its label alone overflows by
  exactly the two caps, and the frame is sized to fill the terminal, so one
  column too many scrolls the whole panel rather than clipping the row. The PR
  row charges for both its pills even though only one is ever non-empty (a merged
  row never also says `GONE`), because a budget that leans on that invariant is
  right only for as long as the invariant is.

  Requires `@kud/ink-ui` 0.18.0, whose `Pill` takes an explicit fill and inks
  itself legibly against it.

### Patch Changes

- 9caaa21: A row too wide for its container no longer folds the whole frame.

  The title budget floored at 20 columns. That is fine while the frame is wide and
  fatal the moment something takes forty of them: a PR row carrying a long repo
  name and two ages has nothing left, takes the floor anyway, and overflows by
  exactly the difference.

  Ink's answer to an overflowing row is not to clip it — it is to compress every
  flexible child in that row. The key, the number and the title all shrink
  together and wrap into a column of fragments, so the list stops looking like a
  list and anything standing beside it is pushed off the screen. One row too wide
  takes the entire layout with it.

  The row now gives up its trailing context in order — author, then threads, then
  repo, then age — before the title is squeezed, and the title floors at 1 rather
  than at a legible minimum, because a floor above what is left is by definition
  an overflow. A one-character title is a bad row; a row that folds the frame is a
  bad screen. The two announcements are absent from that order on purpose: MERGED
  and the transit labels are the news the row exists to carry that moment, and a
  row that dropped its own headline to keep a repo name would have the priority
  exactly backwards.

  Found on a real board rather than in the suite. The specs that existed narrowed
  the frame by mounting a smaller terminal, which cannot work: `COLS` is sampled
  from the real terminal when the module loads, so the rows measured themselves
  against whatever window was running the tests and the assertions passed
  everywhere. The new spec narrows the rows the only way a test can — by opening
  the rail.

## 0.40.0

### Minor Changes

- 1eccd9f: A rail row can say how far through its initiative is.

  `SidebarRow` gains `done` and `total`, drawn as `4/9` before the live count —
  progress first, because it is the question a roadmap is read to answer, and
  `live` second because it qualifies it. An initiative sitting at `4/9 · 0 live` is
  the one you most want to notice, which is why a counted zero is printed rather
  than folded away.

  Both or neither: `counts()` draws the fraction only when it has both halves,
  because a numerator with no denominator is not progress, it is a number. Either
  figure may be absent independently — `live` is what the surface already drew,
  while progress generally means asking the source a second time, and a host that
  could not ask says nothing rather than claiming zero.

  `counts(row)` is exported for hosts laying out their own rail.

## 0.39.0

### Minor Changes

- 3d39e01: The rail opens by default, is wider, has a rule of its own, and you can walk into it.

  **Open by default.** A rail you have to remember to ask for is a rail you never
  consult, and the roadmap is the half of the picture the tabs cannot show at all —
  it earns its columns by being there. `i` still closes it for the stretches where
  the list wants the whole width.

  **Forty columns, not thirty**, and a single left rule separating it from the list.
  A rule rather than a full box: the other three edges already have the frame's
  border a column or two away, and a second rectangle inside the first reads as a
  nested panel — something you could focus and act on. The rule is the whole claim,
  that what is left of it is the list and what is right of it is not. It matches the
  frame's own border rather than picking a second grey.

  **It is now a focus region.** Tab crosses into the rail and back — the one key in
  this UI that means "somewhere else on this screen", where ←→ already mean another
  tab and ↑↓ another row. While it holds focus the arrows move its cursor, `↵` opens
  the row's new optional `url`, and esc hands the arrows back. The footer swaps to
  the rail's own keymap, because advertising `m actions` beside a cursor that cannot
  reach a row names a key that does nothing where you are standing.

  Two marks in two fixed cells, never one cell doing both jobs: `❯` is where you
  are, `←` is what wants you, and a row can easily be both. Focus itself is stated
  in a word — `● focus` — for the same reason every other state here is: a marker
  living only in a hue is a marker a colourblind reader does not have.

  A rail longer than its height scrolls to follow the cursor rather than clamping at
  the last visible row. Clamping would have made the rows counted in `+N more`
  visible and unreachable in the same breath.

  `SidePanel` still owns no keyboard and calls no `useInput`. It DRAWS a cursor;
  where that cursor is, and whether the arrows point at this rail at all, stay the
  host's state — which is what lets a screen with two regions have exactly one lit.

## 0.38.1

### Patch Changes

- 5c5ac59: A rail too short for its roadmap now says how many it could not draw.

  `SidePanel` is fixed to the list's height, and Ink's answer to more rows than
  height is to cut them without a word. That is the one failure this component
  must not have: a roadmap quietly missing its last three initiatives looks exactly
  like a roadmap that has none, and an initiative being invisible is the whole
  reason the rail exists.

  It now keeps one row back whenever anything is left over, and spends that line on
  `+N more`. `railCapacity(height, rows)` is exported for a host that needs to
  price the rail before rendering it.

## 0.38.0

### Minor Changes

- 9a8b4f4: An optional rail for containers of work, beside the list.

  A tab files a row by the stage it is in. A container has no stage of its own — an
  epic moves only because its children did — so it has never had anywhere honest to
  be drawn, and hosts have been squeezing it into the list anyway.

  `App`'s fetcher may now return a `sidebar: { title, rows }`, rendered as a rail on
  the right by `SidePanel`. Each row is a key, a label, an optional count of what is
  live under it, and whether something under it wants you — marked with the same
  arrow, in the same orange, that a PR row uses for the same question. Deliberately
  not a `TaskRow`: the two want opposite fields, and sharing a shape would have
  meant carrying a `status` neither side agrees on.

  It costs nothing unless asked for. No `sidebar` in the fetch result and there is
  no rail, no `i` key, no footer hint and no columns spent — a key that visibly does
  nothing reads as a broken feature rather than as a surface without one. Where
  there is a rail, `i` toggles it and the hint names what it shows rather than the
  furniture.

  The rail's width comes out of the LIST, not the frame. `ItemRow` takes a `cols`
  prop, defaulted to the frame width, and the list hands down the frame minus
  `SIDEBAR_COLS` while the rail is open. A row cannot see the rail, so a budget that
  did not know about it would overflow by the rail's whole width — and the frame is
  sized to fill the terminal, so that scrolls the panel rather than clipping a row.

  The rail applies straight from each fetch rather than waiting behind `r`. The
  manual-apply gate exists so the list cannot reshuffle under you mid-read; the rail
  holds no cursor and nothing is being read down it, so holding it back would only
  leave a stale panel standing beside fresh rows.

## 0.37.0

### Minor Changes

- 734b44b: A task row can carry a category as a filled pill.

  `TaskRow` gains `pill` and `pillVariant`, drawn through `@kud/ink-ui`'s new
  `Pill` after the summary. It is for a category the row BELONGS to — `epic`,
  `blocked`, `spike` — where the word itself is the information and should read as
  one object rather than as more prose at the end of a sentence.

  Deliberately not a second spelling of `note`, which cockpit's epic marker had
  been borrowing. The two want opposite weights: `note` is a reference the reader
  follows — a parent ticket key, a source — and filling a breadcrumb gives it a
  weight it has not earned. A row can carry both, and a story hanging under
  someone else's epic does: its parent's key as the dim note, and its own
  category as the pill.

  The title's width budget charges for the pill including its two caps, via
  `pillWidth`. Pricing a pill by its label alone overflows the row by exactly the
  caps, and the frame is sized to fill the terminal, so one column too many
  scrolls the whole panel rather than clipping the row — the same trap the indent
  term taught this budget one release ago.

  Requires `@kud/ink-ui` 0.17.0.

## 0.36.0

### Minor Changes

- bbd0093: A row that moves between tabs now says so, at both ends.

  The refresh diff asked one question of every row — is it anywhere on the board?
  — so a row that moved from one tab to another was present in both snapshots and
  earned no mark at all. It simply vanished from the tab you were reading, with
  the header reporting nothing to apply.

  The cockpit epic is where this cost the most. An epic's own summary and status
  never change: it moves BECAUSE its children did, so a board-wide diff had
  nothing to notice about it. Watching an epic and its stories disappear mid-read,
  with no marker and no count, was indistinguishable from the cockpit losing them.

  Marks are now keyed per row _per section_, and `Transient` gains `moved-in` and
  `moved-out` alongside `in`, `out` and `changed`. A move dissolves the row where
  it was and coalesces it where it landed, wearing `MOVED` at both ends — never
  `GONE`, which is a claim about the board and would be a lie about a ticket still
  open one tab over. The counts stay per row, so one move is one headline however
  many tabs it touched, and an epic drawn in two tabs at once — which cockpit does
  deliberately — now gets an answer per instance instead of one shared mark.

  `transientOf` takes the section id as a third argument; a row drawn in two tabs
  has two answers and there is no sensible default.

## 0.35.0

### Minor Changes

- a172214: A row can say it is context rather than work, and the counts believe it.

  Rows gained `role?: "container"` — a row that exists to carry context rather
  than to be done. `topLevelCount`, which feeds both the tab badge and the
  whole-board total, now skips those rows.

  Since 0.34.0 a tree can be three levels deep, so a host can draw a grouping row
  over the rows beneath it. Such a row is a real entity — selectable, openable,
  worth seeing — but it is not itself a unit of work, and counting it as one
  inflates every total it appears in. Four rows under one container is four items,
  not five.

  It is `role`, not `uncounted`: a host knows what a row _is_ and should not have
  to know what a badge does with that, and a field named after one consumer starts
  lying the moment a second one reads it. It is a union of one rather than a
  boolean, because `indent` was a boolean that turned out to need a scalar, and
  widening it cost a deprecation still sitting in this file — adding a second role
  later is additive, turning a boolean into a union is not.

  And it is deliberately not spelled as a depth. A container is a genuine
  top-level row with genuine children; pushing it a level down to drop it from a
  count would mean lying about the tree to fix a number, and every site that draws
  indentation reads that lie as truth.

  A collapsed `+N more` row at the top level also stops counting. `topLevelCount`
  excluded only the two header kinds while the search, repo and origin filters all
  excluded the show-more/show-less affordances as well, so one affordance was
  counted as an item everywhere a badge appeared.

  Hosts that set nothing are unaffected — absent means the row is a unit of work,
  which is what every row was before.

## 0.34.0

### Minor Changes

- 73ae70c: Rows carry a real depth, so a tree can be three levels deep.

  Every row type declared `indent: boolean`, which can only say "top level" or
  "under something". Three levels of nesting could not be expressed at all, so a
  grouping row and the row beneath it landed in different groups and read as
  unrelated.

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
  two candidate roots and the question has two honest answers. Rooting at the top
  level regardless would copy rows from branches that were never on screen
  together. The walk now stops at the first row that is a task, or at depth 0,
  whichever comes first. On two-level data both terms coincide with the old rule,
  which is why every test written before this still passes unchanged.

  The blank line between trees stays binary, and only a top-level row can open
  one — otherwise the naive reading puts air inside a tree rather than between
  two, and a non-binary gap would mean the window budget prices a non-binary
  cost, which is where a previous overflow came from.

  A row's glyph run is now computed from its ancestors rather than from a single
  "am I last" boolean. Past two levels the stem has to keep running down the left
  of a subtree that is not the final one, and a collapsed `+N more` row under a
  non-last sibling used to draw a bare corner — losing its ancestor column while
  every visible row above it kept theirs.

## 0.33.0

### Minor Changes

- 84bfccd: The repo fence is a row you can stand on.

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

## 0.32.2

### Patch Changes

- 7db3723: `PIN_MARK` is actually exported now.

  0.32.1's changeset said it was, and it wasn't. It was exported from the inbox
  module — enough for the invariant test's relative import, which is why nothing
  caught it — but never added to the barrel, so it never reached the package's
  public surface. The claim was true of the source and false of the package.

  Consequence was small and real: a host wanting to render its own legend, or to
  assert the same glyph invariant against its own marks, had no way to reach the
  constant and would have hardcoded `"+"` instead — which is the duplication the
  export existed to prevent.

## 0.32.1

### Patch Changes

- ea0cf29: The pin mark is `+`, not `!` — `!` was already `conflict`.

  `health-display.ts` keeps one glyph per state and says why in its own comment:
  the glyph is what distinguishes states, because colour cannot be relied on. The
  pin mark landed in 0.32.0 as `!` in accent orange, which is exactly `conflict` —
  in the same orange, one cell to the left. A PR that was both conflicted and
  pinned rendered `! !`, twice, identically, with nothing to tell the two apart.

  Caught by running the cockpit rather than by reading the diff: the row that
  exposed it was `gnachman/iTerm2#731`, wearing a health `!` beside a turn `→`,
  which made it obvious what a pinned row would have looked like.

  The invariant was right and its scope was too narrow. Uniqueness inside the
  health map does not help when the neighbouring column can draw the same glyph,
  so `PIN_MARK` is exported and `health-display.test.ts` now asserts it against
  every health glyph. That is the test that would have caught this.

## 0.32.0

### Minor Changes

- 2abcca7: `GHItem.pinned` — a turn the viewer claims by hand, outranking every inference.

  The bands read health, tab, standing and who spoke last, and between them they
  are right nearly always. The gap is not accuracy, it is reach: a row can be
  genuinely yours while every signal available says otherwise — nothing red, no
  unresolved thread, nobody waiting on a word — and that knowledge lives with the
  viewer, where no query can go and get it. There was nowhere to put it.

  So `whoseMove` takes a fifth argument and `layoutGHItems` reads it off the item.
  Set, the row is yours; unset or false, everything is decided exactly as before,
  which is what keeps every existing caller unchanged.

  It is a **pin**, not a correction — it applies whether or not the row was
  already yours, so it does not evaporate the moment something else claims the
  turn, and it has no opposite. There is deliberately no way to pin a row away:
  "not mine" is what the bands already conclude unaided, and a control for it
  would only be a way to hide work from the one person who can still act on it.

  The other direction is real but belongs elsewhere. "No reply is owed for this
  particular comment" is a fact about one event with its own expiry — a newer
  comment has to undo it — so it is read where the events are read, and a host
  expresses it by handing back a `lastActor` that no longer claims a turn. That
  needs nothing from this package.

  A pinned row gets its own mark in the turn cell: `!` in the same orange the
  incoming arrow uses. The arrows report who SPOKE last, and a pin is not a turn
  in the conversation — left to them it would sit under Your move wearing a grey
  `→` saying the opposite. Single-width ASCII because that cell is in the aligned
  zone, where a codepoint that renders double-width in some fonts would shift only
  the rows carrying one; mark and colour each say it independently, so neither is
  load-bearing alone. The explain panel spells it out ahead of everything else,
  including the untouched-PR case, where a pin is the most informative thing there
  is to report.

### Patch Changes

- Updated dependencies [2abcca7]
  - @kud/gh@0.9.0

## 0.31.0

### Minor Changes

- dc24239: A row you close now says goodbye before it goes.

  Closing an issue or a PR removed the row on the keypress. The flash said
  `✓ Closed #412` about something that was already off screen, so the one thing
  that could have confirmed which row went — the row itself — was gone before the
  sentence naming it arrived. Merging had exactly this fixed a while back and
  closing never did, which left the two endings of a piece of work behaving
  oppositely: one lingered and sparkled, the other vanished mid-blink.

  A dismissed row now holds for `LEAVING_HOLD_MS` (2.5s) wearing the same GONE the
  refresh puts on a row that left between two fetches — dissolving in the health
  cell, dimmed and struck through — then drops. Same vocabulary rather than a
  third one, because the row is saying the same thing either way: it is leaving.
  Who caused it is the flash's business.

  Shorter than the other two holds, and deliberately. The merge sparkle
  celebrates; the refresh mark has to survive being _noticed_, since it reports
  work done in another window. This one only has to be seen — you pressed the key
  a second ago and are looking at the row it names.

  It reaches every optimistic removal, not just Close: `x` on a review request,
  Close PR + delete branch, and a row-scoped extension calling `target.onRemove`
  (a mute list, a snooze) all get the farewell. The hold belongs to `App`, because
  the row has to keep being rendered for the length of it and the sections it is
  rendered from are App's — `BrowseScreen` hands the dismissal up through a new
  `onLeave` and reads back `leavingUrls`, mirroring how `mergedUrls` already
  worked.

  One rough edge is inherited from the merge path rather than introduced: a close
  GitHub then refuses still drops the row when the hold expires and lets the
  failure's own refresh put it back, so that bounce is 2.5s longer than it was.
  That path already says `restoring #412` out loud, and cancelling the hold
  properly would mean threading a cancellation seam through every caller of an
  action that essentially never fails.

## 0.30.0

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

### Patch Changes

- bed906b: The transit hold now runs on a clock, not on your attention.

  A tab's markers only counted down while you stood on that tab. Arriving to read
  the news and moving on froze the hold where it was, so the markers were still
  there next time you came back — and the way to clear them was to sit on the tab
  doing nothing for seven seconds. That is the reader serving the animation.

  Arriving is the event the hold exists for. So the clock starts the moment a tab
  holding marks is first opened, and keeps running wherever you go afterwards:
  another tab, a drill view, or away from the terminal entirely. A hold that
  expires while you are elsewhere is spent when you get back rather than waiting
  to be watched.

  The half that made the per-tab hold worth having is untouched. A tab nobody has
  opened has no clock at all, so news in a tab you have not visited keeps its
  markers for as long as it takes you to come and collect them.

- Updated dependencies [b21b0d3]
  - @kud/gh@0.8.0

## 0.29.1

### Patch Changes

- 66f4202: `C` and `O` now reach the children a collapsed row is holding.

  `treeUrls` walks the rows drawn under the cursor, and a `show-more` row was
  skipped whole — correctly, in that it carries no URL of its own, but the rows it
  hides were skipped with it. A tree tall enough to collapse therefore yielded
  only the children still on screen.

  That made what `C` copies depend on how many children happened to fit, and the
  screen gives you no way to notice: past the limit the remaining URLs simply stop
  arriving in the clipboard, with nothing anywhere to say so. The walk now
  descends into `hidden`; the `show-more` row itself still contributes nothing, so
  no blank line reaches the clipboard.

## 0.29.0

### Minor Changes

- 6da6332: Row-scoped inbox extensions can now act on the list, not just read it.

  `ExtensionTarget` gains two optional fields: `onRemove(item)` drops the row from
  the view immediately, and `showFlash(msg)` writes to the same status line the
  built-in verbs use.

  Previously an extension was handed the row and the login and nothing to act
  with, so a host that hides rows by its own rule — a mute list, a snooze — had to
  write its state, exit, and leave the row on screen until the next refetch was
  applied. On screen that is indistinguishable from the keypress having done
  nothing. The built-in verbs never had this problem: `x` drops the row before the
  network call it started has answered.

  Both fields are optional, so an existing extension is unaffected.

## 0.28.0

### Minor Changes

- 9838fef: Shift+O opens the whole tree in the browser — the ticket and every PR hanging off it, the same rows Shift+C copies. `o` still opens the row you are on.

## 0.27.0

### Minor Changes

- e4c3104: Shift+C copies the whole tree — the ticket and every PR hanging off it, one URL per line, from wherever inside it the cursor is standing. `c` still copies the row you are on.

## 0.26.5

### Patch Changes

- 27ee390: Only put a blank line above a ticket row when a tree actually starts or ends there.

  `gapsAbove` treated every `task` row as the head of a group, so a tab whose tickets have no PRs got double-spaced for nothing. On the Off Board tab that is ten ticket rows drawn over nineteen lines, which makes the tab look shorter than it is and pushes real rows behind `↓ N more`.

  The gap now asks whether the row above or below is a child. A ticket with PRs beneath it still gets air, and so does the ticket immediately after one — a boundary belongs to both groups. A run of bare tickets renders as the plain list it is. A collapsed tree counts as a tree, so hiding PRs behind `show-more` does not also drop the spacing.

  `isChildRow` moved up beside `gapsAbove`, its only non-trivial reader; it had been sitting 1,100 lines further down and the new dependency held only by module-evaluation order.

- f7f2386: Correct the inbox cost figures quoted throughout the cache and budget comments.

  They said **111 points / 25,550 nodes**, which stopped being true when the own-PR search was capped at 30. The measured figures are **73 points / ~16,870 nodes**. Nothing reads these numbers, but they are the sort quoted back later, and a cache doc that overstates what a fetch costs argues for a longer TTL than the evidence supports.

  The `MY_PRS_LIMIT` note still cites 111 and 25,550 — deliberately, in the past tense, since it is explaining why the cap dropped from 100. `budget.test.ts` keeps `cost: 111` as a fixture: it is a chosen constant the arithmetic hangs off, not a claim about the real query.

  Also updates the TTL note, which blamed the 502s on missing the cache. The cause was asking all eight sources in one request, and `buildInboxQueries` now covers that.

- Updated dependencies [f7f2386]
  - @kud/gh@0.7.1

## 0.26.4

### Patch Changes

- Updated dependencies [230f4f0]
  - @kud/gh@0.7.0

## 0.26.3

### Patch Changes

- c040209: Never gate the first fetch on the budget, and fill the frame while it runs

  **The gate could strand a cold launch.** The startup fetch is not manual, so a
  low budget made it decline itself — leaving the app on "loading" with no rows, no
  error and no way forward, because the pause notice renders in BrowseScreen and
  that is not mounted in the loading phase. A budget is a reason to stop refreshing
  something you can already see; never a reason to show you nothing at all. Only a
  refresh of an already-painted list is gated now.

  **The loading frame was sized with the wrong chrome.** It reused the browse
  view's `rows - 10`, which reserves rows for a tab strip, a filter line and a
  footer that do not exist there — so the frame stopped short and left the terminal
  visibly unfilled, reading as "not fullscreen" even under `alternateScreen: true`.
  It counts its own chrome now, and errs a row short rather than a row long: Ink
  clips overflow from the top, so guessing high eats the header.

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
