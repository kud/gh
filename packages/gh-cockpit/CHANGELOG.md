# @kud/gh-cockpit

## 0.1.2

### Patch Changes

- Updated dependencies [bf0b639]
  - @kud/gh-ink@0.22.1

## 0.1.1

### Patch Changes

- 6e1cf11: Export `DrillView`

  A host registering its own `CheckDrill` renders inside the cockpit's frame and
  needs the same chrome the built-in drills use. Without it the only way to match
  them is to reimplement the border, title and footer by eye.

- Updated dependencies [812676e]
- Updated dependencies [d670704]
  - @kud/gh-ink@0.22.0
