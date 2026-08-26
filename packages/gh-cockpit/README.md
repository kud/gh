# @kud/gh-cockpit

A configurable GitHub cockpit for the terminal — your PRs, reviews and issues in one Ink TUI, grouped by **whose move it is**.

A tab tells you which relationship you are looking at. It never told you whether there was anything to _do_ once you got there, so red CI, merge conflicts and drafts sat interleaved with the rows you could actually act on. This bands every tab into `Your move` / `Their move` instead.

```
Review (20)

  » Your move (2)
  ── acme/api-gateway ─────
  ◆ ← #1495  support statementPeriodIds…    6d
  ── acme/event-bus ───────
  ·   #290   delete the legacy path        14h

  » Their move (9)
  ── acme/monorepo ────────
  ~   #10    add internalNotes field        1w
  ── acme/api-gateway ─────
  ✗ ← #1496  point history at the route     2d
  !   #1449  guard null ids                 6w
```

## Install

```sh
npm install @kud/gh-cockpit
```

It is a **library, not a CLI**: you write the thin entry point, because the interesting decisions — which searches are tabs, which repos rank first, what a check drills into — are yours and not portable.

## Whose move is it

The band comes from the row's health _and_ where you stand relative to it. Those are different questions, and the same token means opposite things depending on the answer:

|                                                       | `authored`<br>your PR | `queued`<br>a review was asked of you | `spoken`<br>you already reviewed |
| ----------------------------------------------------- | --------------------- | ------------------------------------- | -------------------------------- |
| `✗` CI failing · `!` conflict · `±` changes requested | **you**               | them                                  | them                             |
| `·` awaiting review · `*` checks running              | them                  | **you**                               | them                             |
| `✓` approved                                          | **you**               | **you**                               | them                             |
| `◆` open threads                                      | **you**               | **you**                               | **you**                          |
| `~` draft                                             | them                  | them                                  | them                             |

Red CI on a PR you wrote is your afternoon. The same red CI on one you were asked to review is the author's, and reviewing it is wasted. Nothing on the row records that difference — it is a property of the _search_ the row arrived from, which is why `standing` is declared per search rather than inferred.

> [!NOTE]
> Every state has its own glyph, never a colour alone. Colour reinforces; it never carries meaning by itself.

## Configure

```ts
import { defineCockpit } from "@kud/gh-cockpit"
import { delegateExtension } from "@kud/gh-cockpit/extensions"

export default defineCockpit({
  repoPriority: ["acme/monorepo", "acme/", "me/"],
  tabs: [
    {
      label: "Mine",
      help: "your PRs, draft and open",
      searches: ["is:open author:@me"],
    },
    {
      label: "Review",
      help: "theirs — asked of you, or you reviewed",
      searches: [
        { q: "is:open review-requested:@me", standing: "queued" },
        {
          q: "is:open reviewed-by:@me -author:@me -review-requested:@me",
          standing: "spoken",
        },
      ],
    },
  ],
  extensions: [delegateExtension],
})
```

`defineCockpit` is identity, but typed — a config file is checked against the schema at build time rather than producing an empty tab at runtime.

### Repo priority

Ordered, best first. An entry ending in `/` matches an owner; anything else must equal `owner/name`, so a single repo can outrank the owner containing it. Repos matching nothing sort last, together.

Grouping is a separate key from ranking: repos stay clustered whatever the priority list says, because repo headers depend on same-repo rows being adjacent.

## Filtering

```sh
gh-cockpit --include 'acme/*,me/acme-*'
```

`*` matches within one path segment and never across the `/`, so `acme/*` cannot reach another owner and `acme` will not claim `acmecorp`. A bare owner is sugar for all its repos.

```sh
gh-cockpit --exclude 'acme/legacy'
```

Exclude is applied after include and wins, so you can take a whole org and drop one repo without listing the rest.

```sh
gh-cockpit --here
```

`--here` is not a filter. It resolves the repo from your git remote — `upstream` if present, else `origin` — and scopes every search **server-side** with `repo:owner/name`, so other repos are never fetched at all. On a fork that matters: `origin` is your copy and `upstream` is where the PRs actually live.

## Extensions

Extensions live behind their own entry point because they are a choice, not a default — each one claims a keybinding on a surface where every key is already spoken for.

```ts
import {
  delegateExtension,
  copyPromptExtension,
} from "@kud/gh-cockpit/extensions"
```

Both act on the row under the cursor and shell out to nothing, so neither assumes anything about what you have installed.

## Check drill-ins

Activating a CI check opens its log. GitHub Actions is built in; anything else is yours to register, and an unregistered check opens in a browser rather than drilling into a view that renders nothing.

```ts
import { registerCheckDrills } from "@kud/gh-cockpit"

registerCheckDrills([
  {
    match: (url) => url.includes("ci.example"),
    render: ({ url, name, onBack }) => <MyBuildView url={url} name={name} onBack={onBack} />,
  },
])
```

## Host configuration

The library holds no opinion about your machine. `configureInbox` (from `@kud/gh-ink`) is where you supply one, and **every default is empty** — an unconfigured host gets flat repo ranking and no local-checkout resolution, never a guess at where you keep your code.

```ts
import { configureInbox } from "@kud/gh-cockpit"

configureInbox({
  repoPriority: ["acme/", "me/"],
  checkoutDir: `${process.env.HOME}/src`,
  cacheNamespace: "my-cockpit",
  cacheTtlMs: 20 * 60_000,
})
```

> [!TIP]
> `cacheTtlMs` is the single knob between "always current" and "always slow, and drawing 502s from the API" — every launch past it pays the full query. It can be generous: acting on a row drops the cache entry outright, and `r` refetches on demand.

## Refreshing

The cockpit does not poll. A poller spends quota on the long stretches where nothing changed and is still up to a full interval late when something did. Instead, pass `watchPath` and have whatever mutates GitHub write a byte to that file — every open cockpit refetches, debounced. The filesystem is the broker: no daemon, no socket, no fan-out to manage.

> [!IMPORTANT]
> Write a byte rather than `touch`ing. At second-granularity mtime with no size change, two touches inside the same second are indistinguishable and some watch backends coalesce them away.

## Licence

MIT © Erwann Mest
