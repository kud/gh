# @kud/gh-webhook-replay

## 0.1.37

### Patch Changes

- 894f9ae: Built against `@kud/ink-ui` 0.36.0. Ticket keys now take their yellow from ink-ui's `ticket` token rather than a hex of their own, so every TUI draws a key alike; the `@kud/ink-ui` peer range moves to `>=0.36.0 <1` because an older host has no such token and would draw the key uncoloured. The inbox search also follows the new `useFilterMode`: `esc` while typing used to clear the term on the way out, throwing away the query a reflexive press was only meant to step out of, and now it keeps the filter just as `↵` does. `⌃u` empties the term inside the field, and `esc` on a kept filter still clears it, so two presses clear it from anywhere.

## 0.1.36

### Patch Changes

- Updated dependencies [2e31325]
  - @kud/gh@0.21.0

## 0.1.35

### Patch Changes

- 89c8768: Sections can declare an optional `group`; the inbox tab strip draws a divider where it changes. Requires @kud/ink-ui 0.35.0.

## 0.1.34

### Patch Changes

- 1d40c2f: Built against `@kud/ink-ui` 0.34.0, whose command palette paints its whole box, so rows underneath no longer show through the launcher.
- 4257f4a: `@kud/ink-ui` is now a peer dependency of gh-ink (`^0.33.0`) rather than a pinned dependency, so a host and gh-ink always share one copy. ink-ui keeps the icon mode in module state, and a second nested copy meant a host's `setIconMode("nerd")` never reached it. The CLIs move to ink-ui 0.33.2.

## 0.1.33

### Patch Changes

- Updated dependencies [25a8d82]
  - @kud/gh@0.20.0

## 0.1.32

### Patch Changes

- 923462b: Every package moves to `@kud/ink-ui` 0.33.0 together. A host that also draws with ink-ui at that version — the Jira board does — was loading a second copy beside these packages' 0.31.0, and two copies of the component library in one process configure one instance and read the other. The skeleton rows also pick up 0.33.0's shimmer.

## 0.1.31

### Patch Changes

- Updated dependencies [86e66de]
- Updated dependencies [9e6b595]
  - @kud/gh@0.19.0

## 0.1.30

### Patch Changes

- 6bbad1a: Every package moves to `@kud/ink-ui` 0.31.0 together, so the workspace still carries a single copy. The release adds `useFilterMode`, the shared list filter the inbox now runs on.

## 0.1.29

### Patch Changes

- Updated dependencies [7400832]
  - @kud/gh@0.18.0

## 0.1.28

### Patch Changes

- 095ccfd: `@kud/ink-ui` 0.29.0 → 0.30.0 on every package at once, which is what brings `CommandPalette` in. All five pins move together so npm keeps one deduped copy: two copies of a component library in one process is a module-level singleton configured in one instance and read from the other.

## 0.1.27

### Patch Changes

- Updated dependencies [c1115f3]
- Updated dependencies [4c8bc86]
- Updated dependencies [cac544b]
  - @kud/gh@0.17.0

## 0.1.26

### Patch Changes

- fa57f75: ←→ on a tab bar wrap, and belong to the hook.

  `@kud/ink-ui` 0.29.0's `useTabs` binds ←→ itself, so the PR drill's own arrow binding comes out — left in, every press would have switched tabs twice. The inbox does not mount the hook (its tab is a position over sections that come and go), but its arrows now wrap at the ends exactly as Tab already did four lines below: one bar, one end behaviour.

  Every package pins `@kud/ink-ui` 0.29.0 together, per the one-copy rule.

## 0.1.25

### Patch Changes

- 947407c: `q` hands the terminal back.

  The inbox quit with `process.exit(0)` from the browse screen and from the empty-and-failed screen, which killed the process under Ink before it could unmount — the alternate screen was left up and whatever was on it stayed on the user's terminal. Both now call Ink's own `exit()`, which unmounts, restores the screen and then lets the process end. The drills still close on `q` as well as `esc`; making `q` quit from inside them waits on their text fields reporting focus, or a letter typed into a reply would end the app.

  Every package pins `@kud/ink-ui` 0.28.2 together, per the one-copy rule: it brings `useAppKeys`, `Page` and the footer tail that the rest of the fleet has moved to, so cockpit's hosts can adopt them without a second copy of the library in the process.

## 0.1.24

### Patch Changes

- 1897583: A row's labels now read as their own tier, and a repo can declare the labels
  its convention puts on every issue so rows there stop repeating the header.

  Labels and age both inked in `dimColor`, so the row that was designed with
  three tiers — title, labels, furniture — rendered two, and the labels read as
  noise beside the date. The cell now takes `@kud/ink-ui`'s new
  `colors.secondary`, measured one clear step above the faint; the turn arrow
  and the answered thread count, which were the same register in a hand-picked
  `#888888`, move to the same token, so the row has exactly three neutrals.

  `configureInbox` gains `impliedLabels`, keyed by `owner/name`: a worklist repo
  whose every issue carries `plan` names it once, and rows under that header omit
  it — filtered before the rank and the two-slot cut, so it never takes a slot and
  then vanishes. A row whose only label was implied draws no cell at all, which is
  what an unlabelled row draws. The same label still shows on a repo that did not
  imply it, where it is exactly what separates a plan from a bug report. Every
  package's `@kud/ink-ui` pin moves to 0.26.0 together.

## 0.1.23

### Patch Changes

- Updated dependencies [befcc51]
  - @kud/gh@0.16.0

## 0.1.22

### Patch Changes

- fed8509: A row's pill is now a soft fill; event pills stay solid.

  The outline shipped this morning was a step too far: on a dark ground a
  hue-only ring loses the label it exists to carry, and the point of a type pill
  is to be read at a glance on every row. What was wrong was the colour, not the
  fill. The law now reads: the column says where it sits, soft says what it is,
  solid says something happened. `TaskRow.pill` takes `@kud/ink-ui`'s new
  `tone="soft"` — a quiet, measured fill from `softColors` with white ink —
  while `merged`, `NEW` and `GONE` keep the loud solid fill that marks news.
  `pillVariant` also accepts the new `group` variant, for an epic that holds the
  rows beneath it. Every package's `@kud/ink-ui` pin moves to 0.25.0 together.

## 0.1.21

### Patch Changes

- Updated dependencies [aa5cded]
  - @kud/gh@0.15.0

## 0.1.20

### Patch Changes

- Updated dependencies [66f058d]
  - @kud/gh@0.14.0

## 0.1.19

### Patch Changes

- Updated dependencies [2d3564b]
  - @kud/gh@0.13.0

## 0.1.18

### Patch Changes

- Updated dependencies [a853ce5]
  - @kud/gh@0.12.3

## 0.1.17

### Patch Changes

- Updated dependencies [cd62fd9]
  - @kud/gh@0.12.2

## 0.1.16

### Patch Changes

- Updated dependencies [9dd17b8]
  - @kud/gh@0.12.1

## 0.1.15

### Patch Changes

- Updated dependencies [5e4b549]
  - @kud/gh@0.12.0

## 0.1.14

### Patch Changes

- Updated dependencies [b5512f9]
  - @kud/gh@0.11.0

## 0.1.13

### Patch Changes

- 8be6855: `@kud/ink-ui@0.22.0`, which takes the sliding underline off the tab bar. The rule lands under the active tab on the frame the tab changes, and the highlight lands with it — no travel, no lead-and-follow.

  It reaches the cockpit through this bump rather than through anything here, and it is worth a line because the tab bar is the one component drawn across the top of every screen: a half-tuned animation there is the first thing the eye goes to and the last thing that should be asking for attention. The slide was three releases of tuning that had not converged, so it was parked whole on `feat/tabs-underline-animation` upstream — step count, ease shape and the lead/follow split intact — to be finished rather than rewritten. Tab markers are untouched.

  All six packages move together, which is the invariant this repo now states outright: a second copy of the component library in one process is a module-level singleton configured in one instance and read from the other.

## 0.1.12

### Patch Changes

- 858fd78: One `@kud/ink-ui` in the tree instead of two. These three CLIs sat on `0.8.0` while `gh-ink` and `gh-cockpit` moved to `0.21.0`, so npm hoisted one copy and nested the other — and two copies of a component library in one process is the shape of bug where a module-level singleton is configured in one instance and read from the other. It had not bitten yet because ink-ui's only such singleton is `setIconMode`/`getIconMode`, which nothing here calls; that is luck rather than design, and luck is not a dependency policy.

  Nothing renders differently. All three import exactly one thing — `colors` — and the token object is unchanged across the seven minors. What the bump actually buys is the hazard going away and, incidentally, `node_modules/@kud/ink-ui/AGENTS.md`, which `0.16.0` began shipping inside the package: the brief that says which components own their own Ink `useInput` and which are presentational. A pin below `0.16.0` left nothing there to read.

  `npm ls @kud/ink-ui` now reports a single version with every line `deduped`. That is the check worth re-running after any dependency edit here, and the repo's `CLAUDE.md` says so.

## 0.1.11

### Patch Changes

- Updated dependencies [2abcca7]
  - @kud/gh@0.9.0

## 0.1.10

### Patch Changes

- Updated dependencies [b21b0d3]
  - @kud/gh@0.8.0

## 0.1.9

### Patch Changes

- Updated dependencies [f7f2386]
  - @kud/gh@0.7.1

## 0.1.8

### Patch Changes

- Updated dependencies [230f4f0]
  - @kud/gh@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies [aa9ae55]
  - @kud/gh@0.6.0

## 0.1.6

### Patch Changes

- Updated dependencies [7be0454]
  - @kud/gh@0.5.1

## 0.1.5

### Patch Changes

- Updated dependencies [37586f4]
  - @kud/gh@0.5.0

## 0.1.4

### Patch Changes

- Updated dependencies
  - @kud/gh@0.4.1

## 0.1.3

### Patch Changes

- Updated dependencies [67c40eb]
  - @kud/gh@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [1bdf706]
  - @kud/gh@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [f476456]
  - @kud/gh@0.2.0
