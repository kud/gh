# @kud/gh-pr-health

## 0.1.76

### Patch Changes

- @kud/gh-ink@0.44.4

## 0.1.75

### Patch Changes

- Updated dependencies [9e67e56]
- Updated dependencies [b5512f9]
  - @kud/gh-ink@0.44.3
  - @kud/gh@0.11.0

## 0.1.74

### Patch Changes

- Updated dependencies [089678d]
  - @kud/gh-ink@0.44.2

## 0.1.73

### Patch Changes

- 8be6855: `@kud/ink-ui@0.22.0`, which takes the sliding underline off the tab bar. The rule lands under the active tab on the frame the tab changes, and the highlight lands with it — no travel, no lead-and-follow.

  It reaches the cockpit through this bump rather than through anything here, and it is worth a line because the tab bar is the one component drawn across the top of every screen: a half-tuned animation there is the first thing the eye goes to and the last thing that should be asking for attention. The slide was three releases of tuning that had not converged, so it was parked whole on `feat/tabs-underline-animation` upstream — step count, ease shape and the lead/follow split intact — to be finished rather than rewritten. Tab markers are untouched.

  All six packages move together, which is the invariant this repo now states outright: a second copy of the component library in one process is a module-level singleton configured in one instance and read from the other.

- Updated dependencies [a634508]
- Updated dependencies [8be6855]
  - @kud/gh-ink@0.44.1

## 0.1.72

### Patch Changes

- 858fd78: One `@kud/ink-ui` in the tree instead of two. These three CLIs sat on `0.8.0` while `gh-ink` and `gh-cockpit` moved to `0.21.0`, so npm hoisted one copy and nested the other — and two copies of a component library in one process is the shape of bug where a module-level singleton is configured in one instance and read from the other. It had not bitten yet because ink-ui's only such singleton is `setIconMode`/`getIconMode`, which nothing here calls; that is luck rather than design, and luck is not a dependency policy.

  Nothing renders differently. All three import exactly one thing — `colors` — and the token object is unchanged across the seven minors. What the bump actually buys is the hazard going away and, incidentally, `node_modules/@kud/ink-ui/AGENTS.md`, which `0.16.0` began shipping inside the package: the brief that says which components own their own Ink `useInput` and which are presentational. A pin below `0.16.0` left nothing there to read.

  `npm ls @kud/ink-ui` now reports a single version with every line `deduped`. That is the check worth re-running after any dependency edit here, and the repo's `CLAUDE.md` says so.

- Updated dependencies [21cc38e]
  - @kud/gh-ink@0.44.0

## 0.1.71

### Patch Changes

- Updated dependencies [0f9e7ae]
  - @kud/gh-ink@0.43.3

## 0.1.70

### Patch Changes

- Updated dependencies [608e7db]
  - @kud/gh-ink@0.43.2

## 0.1.69

### Patch Changes

- Updated dependencies [154daf6]
  - @kud/gh-ink@0.43.1

## 0.1.68

### Patch Changes

- Updated dependencies [07dd4f5]
  - @kud/gh-ink@0.43.0

## 0.1.67

### Patch Changes

- Updated dependencies [c426058]
  - @kud/gh-ink@0.42.1

## 0.1.66

### Patch Changes

- Updated dependencies [cbcbd71]
  - @kud/gh-ink@0.42.0

## 0.1.65

### Patch Changes

- Updated dependencies [9caaa21]
- Updated dependencies [9caaa21]
  - @kud/gh-ink@0.41.0

## 0.1.64

### Patch Changes

- Updated dependencies [1eccd9f]
  - @kud/gh-ink@0.40.0

## 0.1.63

### Patch Changes

- Updated dependencies [3d39e01]
  - @kud/gh-ink@0.39.0

## 0.1.62

### Patch Changes

- Updated dependencies [5c5ac59]
  - @kud/gh-ink@0.38.1

## 0.1.61

### Patch Changes

- Updated dependencies [9a8b4f4]
  - @kud/gh-ink@0.38.0

## 0.1.60

### Patch Changes

- Updated dependencies [734b44b]
  - @kud/gh-ink@0.37.0

## 0.1.59

### Patch Changes

- Updated dependencies [bbd0093]
  - @kud/gh-ink@0.36.0

## 0.1.58

### Patch Changes

- Updated dependencies [a172214]
  - @kud/gh-ink@0.35.0

## 0.1.57

### Patch Changes

- Updated dependencies [73ae70c]
- Updated dependencies [6de6467]
  - @kud/gh-ink@0.34.0

## 0.1.56

### Patch Changes

- Updated dependencies [84bfccd]
  - @kud/gh-ink@0.33.0

## 0.1.55

### Patch Changes

- Updated dependencies [7db3723]
  - @kud/gh-ink@0.32.2

## 0.1.54

### Patch Changes

- Updated dependencies [ea0cf29]
  - @kud/gh-ink@0.32.1

## 0.1.53

### Patch Changes

- Updated dependencies [2abcca7]
- Updated dependencies [2abcca7]
  - @kud/gh-ink@0.32.0
  - @kud/gh@0.9.0

## 0.1.52

### Patch Changes

- Updated dependencies [dc24239]
  - @kud/gh-ink@0.31.0

## 0.1.51

### Patch Changes

- Updated dependencies [b21b0d3]
- Updated dependencies [bed906b]
  - @kud/gh@0.8.0
  - @kud/gh-ink@0.30.0

## 0.1.50

### Patch Changes

- Updated dependencies [66f4202]
  - @kud/gh-ink@0.29.1

## 0.1.49

### Patch Changes

- Updated dependencies [6da6332]
  - @kud/gh-ink@0.29.0

## 0.1.48

### Patch Changes

- Updated dependencies [9838fef]
  - @kud/gh-ink@0.28.0

## 0.1.47

### Patch Changes

- Updated dependencies [e4c3104]
  - @kud/gh-ink@0.27.0

## 0.1.46

### Patch Changes

- Updated dependencies [27ee390]
- Updated dependencies [f7f2386]
  - @kud/gh-ink@0.26.5
  - @kud/gh@0.7.1

## 0.1.45

### Patch Changes

- Updated dependencies [230f4f0]
  - @kud/gh@0.7.0
  - @kud/gh-ink@0.26.4

## 0.1.44

### Patch Changes

- Updated dependencies [c040209]
  - @kud/gh-ink@0.26.3

## 0.1.43

### Patch Changes

- Updated dependencies [03960d1]
  - @kud/gh-ink@0.26.2

## 0.1.42

### Patch Changes

- Updated dependencies [8ad4867]
  - @kud/gh-ink@0.26.1

## 0.1.41

### Patch Changes

- Updated dependencies [d06a81b]
- Updated dependencies [aa9ae55]
  - @kud/gh-ink@0.26.0
  - @kud/gh@0.6.0

## 0.1.40

### Patch Changes

- Updated dependencies [189b758]
- Updated dependencies [e0c7f1a]
  - @kud/gh-ink@0.25.0

## 0.1.39

### Patch Changes

- Updated dependencies [90abb23]
  - @kud/gh-ink@0.24.0

## 0.1.38

### Patch Changes

- Updated dependencies [4295ada]
- Updated dependencies [48d06d8]
  - @kud/gh-ink@0.23.3

## 0.1.37

### Patch Changes

- Updated dependencies [352a7e9]
  - @kud/gh-ink@0.23.2

## 0.1.36

### Patch Changes

- Updated dependencies [fd2a3ca]
  - @kud/gh-ink@0.23.1

## 0.1.35

### Patch Changes

- Updated dependencies [09c027c]
- Updated dependencies [e8bb5d2]
  - @kud/gh-ink@0.23.0

## 0.1.34

### Patch Changes

- Updated dependencies [bf0b639]
  - @kud/gh-ink@0.22.1

## 0.1.33

### Patch Changes

- Updated dependencies [812676e]
- Updated dependencies [d670704]
  - @kud/gh-ink@0.22.0

## 0.1.32

### Patch Changes

- Updated dependencies [14a7ca4]
- Updated dependencies [10473fc]
  - @kud/gh-ink@0.21.0

## 0.1.31

### Patch Changes

- Updated dependencies [1ccd3fe]
  - @kud/gh-ink@0.20.0

## 0.1.30

### Patch Changes

- Updated dependencies [fe461c7]
  - @kud/gh-ink@0.19.0

## 0.1.29

### Patch Changes

- Updated dependencies [1f680d9]
- Updated dependencies [b38f3d5]
- Updated dependencies [84604c6]
  - @kud/gh-ink@0.18.0

## 0.1.28

### Patch Changes

- Updated dependencies [e4dbd10]
  - @kud/gh-ink@0.17.0

## 0.1.27

### Patch Changes

- Updated dependencies [babb7f7]
  - @kud/gh-ink@0.16.4

## 0.1.26

### Patch Changes

- Updated dependencies [a8b34ce]
  - @kud/gh-ink@0.16.3

## 0.1.25

### Patch Changes

- Updated dependencies [64abc24]
  - @kud/gh-ink@0.16.2

## 0.1.24

### Patch Changes

- Updated dependencies [b876da7]
  - @kud/gh-ink@0.16.1

## 0.1.23

### Patch Changes

- Updated dependencies [505607b]
- Updated dependencies [84ef5b4]
  - @kud/gh-ink@0.16.0

## 0.1.22

### Patch Changes

- Updated dependencies [a37b400]
- Updated dependencies [79616e5]
  - @kud/gh-ink@0.15.0

## 0.1.21

### Patch Changes

- Updated dependencies [e3624a0]
  - @kud/gh-ink@0.14.0

## 0.1.20

### Patch Changes

- Updated dependencies [04138cc]
  - @kud/gh-ink@0.13.0

## 0.1.19

### Patch Changes

- Updated dependencies [0fc3007]
  - @kud/gh-ink@0.12.0

## 0.1.18

### Patch Changes

- Updated dependencies [bc5459b]
  - @kud/gh-ink@0.11.1

## 0.1.17

### Patch Changes

- Updated dependencies [fabc8cb]
  - @kud/gh-ink@0.11.0

## 0.1.16

### Patch Changes

- Updated dependencies [0ac0503]
  - @kud/gh-ink@0.10.0

## 0.1.15

### Patch Changes

- Updated dependencies [ed3aa1e]
  - @kud/gh-ink@0.9.1

## 0.1.14

### Patch Changes

- Updated dependencies [fcd8a26]
  - @kud/gh-ink@0.9.0

## 0.1.13

### Patch Changes

- Updated dependencies [5c867a0]
  - @kud/gh-ink@0.8.1

## 0.1.12

### Patch Changes

- Updated dependencies [7be0454]
- Updated dependencies [7be0454]
  - @kud/gh-ink@0.8.0
  - @kud/gh@0.5.1

## 0.1.11

### Patch Changes

- Updated dependencies [37586f4]
  - @kud/gh@0.5.0
  - @kud/gh-ink@0.7.1

## 0.1.10

### Patch Changes

- Updated dependencies [9fcc195]
  - @kud/gh-ink@0.7.0

## 0.1.9

### Patch Changes

- Updated dependencies
  - @kud/gh-ink@0.6.0

## 0.1.8

### Patch Changes

- Updated dependencies
  - @kud/gh@0.4.1
  - @kud/gh-ink@0.5.3

## 0.1.7

### Patch Changes

- Updated dependencies [67c40eb]
  - @kud/gh@0.4.0
  - @kud/gh-ink@0.5.2

## 0.1.6

### Patch Changes

- Updated dependencies [1bdf706]
  - @kud/gh@0.3.0
  - @kud/gh-ink@0.5.1

## 0.1.5

### Patch Changes

- Updated dependencies [cd60c53]
  - @kud/gh-ink@0.5.0

## 0.1.4

### Patch Changes

- Updated dependencies [2779c4c]
- Updated dependencies [2779c4c]
  - @kud/gh-ink@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [abb024f]
- Updated dependencies [c5ad810]
  - @kud/gh-ink@0.3.1

## 0.1.2

### Patch Changes

- Updated dependencies [04ffe69]
  - @kud/gh-ink@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [f476456]
- Updated dependencies [f476456]
  - @kud/gh-ink@0.2.0
  - @kud/gh@0.2.0
