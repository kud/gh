# @kud/gh-cockpit

## 0.1.14

### Patch Changes

- Updated dependencies [27ee390]
- Updated dependencies [f7f2386]
  - @kud/gh-ink@0.26.5
  - @kud/gh@0.7.1

## 0.1.13

### Patch Changes

- 230f4f0: Let the account-wide inbox be asked for in several requests instead of one.

  GitHub's proxy answers a request, not a query, so the ceiling on the inbox is wall clock rather than cost. Measured against an account-wide inbox on 2026-08-28: the eight-source query returns HTTP 502 on roughly two runs in three, after 10–30s, while the same eight sources asked one at a time return 200 every time — for the same 73 points and the same ~16,870 nodes. Adding sources one at a time shows a clean gradient: five is reliable, six starts failing, eight mostly fails. Repo-scoped queries were never affected, because `repo:` narrows what the search index has to walk and `author:@me` across an account does not.

  - `buildInboxQuery` takes `sources`, so any subset can be asked for. Every subset is still a complete document carrying its own `rateLimit` and `viewer`.
  - `buildInboxQueries` splits the inbox into independent queries — two sources each by default (`INBOX_SOURCES_PER_QUERY`) — to be issued in parallel.
  - `mergeInboxData` reassembles them: aliases merge by assignment, `cost` and `nodeCount` sum, and `remaining`/`resetAt` take the scarcest reading.
  - `INBOX_SOURCES` and the `InboxSource` type name the eight sources.

  `buildInboxQuery()` with no arguments emits the same query it always did, byte for byte.

- Updated dependencies [230f4f0]
  - @kud/gh@0.7.0
  - @kud/gh-ink@0.26.4

## 0.1.12

### Patch Changes

- Updated dependencies [c040209]
  - @kud/gh-ink@0.26.3

## 0.1.11

### Patch Changes

- Updated dependencies [03960d1]
  - @kud/gh-ink@0.26.2

## 0.1.10

### Patch Changes

- Updated dependencies [8ad4867]
  - @kud/gh-ink@0.26.1

## 0.1.9

### Patch Changes

- Updated dependencies [d06a81b]
- Updated dependencies [aa9ae55]
  - @kud/gh-ink@0.26.0
  - @kud/gh@0.6.0

## 0.1.8

### Patch Changes

- Updated dependencies [189b758]
- Updated dependencies [e0c7f1a]
  - @kud/gh-ink@0.25.0

## 0.1.7

### Patch Changes

- Updated dependencies [90abb23]
  - @kud/gh-ink@0.24.0

## 0.1.6

### Patch Changes

- Updated dependencies [4295ada]
- Updated dependencies [48d06d8]
  - @kud/gh-ink@0.23.3

## 0.1.5

### Patch Changes

- Updated dependencies [352a7e9]
  - @kud/gh-ink@0.23.2

## 0.1.4

### Patch Changes

- Updated dependencies [fd2a3ca]
  - @kud/gh-ink@0.23.1

## 0.1.3

### Patch Changes

- Updated dependencies [09c027c]
- Updated dependencies [e8bb5d2]
  - @kud/gh-ink@0.23.0

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
