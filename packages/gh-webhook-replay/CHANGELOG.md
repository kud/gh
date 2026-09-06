# @kud/gh-webhook-replay

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
