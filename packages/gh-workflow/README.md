# @kud/gh-workflow

The workflow half of a GitHub inbox, with no surface attached — whose move a row
is, and how rows sort, group and filter. Every export is a total function over
plain data, so a terminal renderer, a browser and a server route consume it
alike.

Nothing in here may import a renderer, a transport or the filesystem. A test
asserts that against the **built** output rather than the source, because inside
the workspace every forbidden dependency is installed and an accidental import
simply succeeds.

## Install

```sh
npm install @kud/gh-workflow
```

## API

### Whose move is it

```ts
import { whoseMove, bandOf, layoutGHItems } from "@kud/gh-workflow"

whoseMove(health, sectionId, standing?, theySpokeLast?, pinned?, ownsRepo?)
// → "you" | "them" | "unknown"
```

Three answers rather than two, and the third is the point: a row with no health
to read — an issue from somebody else's tab, or a `minimal` fetch that omitted
the health selection — declines a verdict instead of quietly becoming `them`.

`standing` says where you stand on the row, and is declared per search because
nothing on a row records it. A PR awaiting your review and one you already
reviewed are the same PR to GitHub's API, and opposite things to you.

| Standing   | Meaning                       |
| ---------- | ----------------------------- |
| `authored` | your PR, or an issue of yours |
| `queued`   | a review was asked of you     |
| `spoken`   | you have already reviewed it  |

`bandOf` resolves one step further on `authored`, where your move has more than
one verb: `merge` (approved, or awaiting review on a repo you own), `draft`, and
`whoseMove` for everything between. `layoutGHItems(items, sectionId, login)`
lays a tab out in those bands — `Ready to merge`, `Your move`, `Drafts`,
`Unclassified`, `Their move` — each with its own repo grouping; `layoutSides`
does the same per named side. The login is required: two of the claims read the
row against the viewer, and without it they collapse to false in the one
direction the bands exist to prevent.

The health token itself comes from [`@kud/gh`](../gh). Moving a check conclusion
between its predicates moves rows between these bands.

### Rows and layout

- `toGHItem(node)` maps a GraphQL node to a `GHItem`; `computeHealth` and
  `healthOf` give the token behind it.
- `sortItems`, `sortByRecency` and `insertRepoHeaders` order and group rows.
- `filterByRepos`, `filterByOrigin` and `filterBySearch` narrow a list.
- `relativeTime`, `sizeOf`, `sizePartsOf` and `filesOf` format the small labels.

### Configuration

```ts
import { configureInbox } from "@kud/gh-workflow"

configureInbox({
  repoPriority: ["acme/api-gateway", "acme/"],
  labelPriority: ["bug", "app:*"],
  impliedLabels: { "acme/plans": ["plan"] },
  cacheNamespace: "my-cockpit",
  cacheTtlMs: 20 * 60_000,
})
```

Everything the library refuses to assume, and the defaults are empty on purpose:
a ranking of one author's repos is wrong for the next reader. `profiles` take a
`RepoProfile` (`name`, `label`, `match`, `checkoutDir`).

### Search and references

`parseSearchQuery` and `matchesSearchQuery` implement the `/` search —
whitespace-split terms, quoted phrases, `author:` and `repo:` qualifiers, a
leading `-` to negate, everything ANDed.

`resolveRef(input, { fetchNode, activeRepo, repos })` turns a typed reference
into a row. The fetch is passed in — `fetchItemNode` from `@kud/gh` in a
terminal — which is what keeps this package browser-safe.

## Development

```sh
npm run typecheck
npm run test
npm run build
```

## Licence

MIT © Erwann Mest
