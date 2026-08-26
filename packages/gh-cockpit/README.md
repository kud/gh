<div align="center">

🛫

# Cockpit

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/gh-cockpit?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**A configurable GitHub cockpit for the terminal — your PRs, reviews and issues in one Ink TUI, grouped by whose move it is.**

[Features](#-features) • [Quick Start](#-quick-start) • [API Reference](#-api-reference) • [Development](#-development)

</div>

## 🌟 Features

- 🎯 **Whose-move bands** — every tab splits into `Your move` and `Their move`, so the two rows you can act on stop hiding among the eighteen you can't
- 🧭 **Standing, not guesswork** — the same `✗` is your afternoon on a PR you wrote and the author's on one you were asked to review; the band knows which
- 🔍 **`--here` scoping** — resolves the repo from your git remote and scopes every search server-side, so other repos are never fetched at all
- 🎛 **Pattern filtering** — `--include acme/*,me/acme-*` and `--exclude`, replacing any built-in notion of which repos are "yours"
- 🔌 **Bring your own CI** — GitHub Actions logs are built in; register a drill-in for anything else, or let it open in a browser
- ♿ **Readable without colour** — every state carries its own glyph, so the list survives being piped, logged, or read by someone who can't separate green from orange
- 🪶 **No opinions baked in** — repo ranking, checkout locations and cache lifetime are all supplied by the host; the defaults are empty on purpose

## 🚀 Quick Start

```sh
npm install @kud/gh-cockpit
```

It is a library, not a CLI — you write the entry point, because which searches become tabs and which repos rank first are not portable decisions.

```tsx
import { render } from "ink"
import { App, configureInbox, defineCockpit, detailFor } from "@kud/gh-cockpit"
import { delegateExtension } from "@kud/gh-cockpit/extensions"

configureInbox({
  repoPriority: ["acme/monorepo", "acme/", "me/"],
  checkoutDir: `${process.env.HOME}/src`,
})

export default defineCockpit({
  tabs: [
    { label: "Mine", help: "your PRs", searches: ["is:open author:@me"] },
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

Which renders:

```console
$ cockpit

  🚀 Cockpit    29 items · @you                          updated 2m ago
  Mine (7)  Review (20)  Incoming (4)  Issues (3)  Done (13)
            ───────────

  » Your move (2)

  ── acme/api-gateway ─────
  ◆ ← #1495  support statementPeriodIds in the report      6d
  ── acme/event-bus ───────
  ·   #290   delete the legacy serving path               14h

  » Their move (18)

  ── acme/monorepo ────────
  ~   #10    add internalNotes to Contract                 1w
  ── acme/api-gateway ─────
  ✗ ← #1496  point history at the generic route            2d
  !   #1449  guard null ids before per-id fetches          6w
```

## 📖 API Reference

| Export                                   | Purpose                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `defineCockpit(config)`                  | Typed config — a wrong tab or standing fails at build, not at runtime                    |
| `configureInbox(config)`                 | Host opinions: `repoPriority`, `profiles`, `checkoutDir`, `cacheNamespace`, `cacheTtlMs` |
| `parseArgs(argv)`                        | `--here`, `--include`, `--exclude`, and a positional named filter                        |
| `registerCheckDrills(drills)`            | Where a CI check drills in; unregistered checks open in a browser                        |
| `detailFor(ctx)`                         | The drill-in view for a row — `PrView` or `IssueView`                                    |
| `PrView` · `IssueView`                   | The drill-in views themselves, if you want to wrap them                                  |
| `withRetry(fn)`                          | Retries transient `50x` responses; GitHub returns them under load                        |
| `toGHItem(node)` · `computeHealth(node)` | GraphQL node → row, and the health token behind each glyph                               |

### Whose move is it

|                                                       | `authored`<br>your PR | `queued`<br>asked of you | `spoken`<br>you reviewed |
| ----------------------------------------------------- | --------------------- | ------------------------ | ------------------------ |
| `✗` CI failing · `!` conflict · `±` changes requested | **you**               | them                     | them                     |
| `·` awaiting review · `*` checks running              | them                  | **you**                  | them                     |
| `✓` approved                                          | **you**               | **you**                  | them                     |
| `◆` open threads                                      | **you**               | **you**                  | **you**                  |
| `~` draft                                             | them                  | them                     | them                     |

`standing` is declared per search rather than inferred, because nothing on a row records it: a PR awaiting review and one you already reviewed are the same PR to GitHub's API, and opposite things to you.

### Filtering

```sh
cockpit --include 'acme/*,me/acme-*'
```

`*` matches within one path segment and never across the `/`, so `acme/*` cannot reach another owner and `acme` will not claim `acmecorp`. A bare owner is sugar for all its repos. `--exclude` is applied after `--include` and wins, so you can take a whole org and drop one repo without listing the rest.

## 🔧 Development

```sh
git clone https://github.com/kud/gh.git
```

```sh
cd gh && npm install
```

```sh
npm run build --workspace @kud/gh-cockpit
```

| Script              | Does                               |
| ------------------- | ---------------------------------- |
| `npm run build`     | Compile `src/` → `dist/` with tsup |
| `npm run dev`       | Same, in watch mode                |
| `npm run typecheck` | `tsc --noEmit`                     |
| `npm test`          | Vitest                             |

```
src/
  config.ts        defineCockpit and the config types
  args.ts          --here / --include / --exclude parsing
  lib.ts           shared layer, re-exports @kud/gh-ink
  views/           PrView, IssueView, and the drill-in views
  extensions/      opt-in extensions, exported separately
```

## 🏗 Tech Stack

|                                                          |                                                    |
| -------------------------------------------------------- | -------------------------------------------------- |
| [@kud/gh](https://www.npmjs.com/package/@kud/gh)         | Surface-agnostic core: queries, health computation |
| [@kud/gh-ink](https://www.npmjs.com/package/@kud/gh-ink) | Ink components, whose-move banding, layout         |
| [@kud/ink-ui](https://www.npmjs.com/package/@kud/ink-ui) | Terminal UI primitives                             |
| [zx](https://www.npmjs.com/package/zx)                   | Shelling out to `gh`                               |

---

MIT © [kud](https://github.com/kud) — Made with ❤️
