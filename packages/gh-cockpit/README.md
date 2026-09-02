<div align="center">

🛫

# Cockpit

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/gh-cockpit?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**A configurable GitHub cockpit for the terminal — your PRs, reviews and issues in one Ink TUI, grouped by whose move it is.**

[Features](#-features) • [Quick Start](#-quick-start) • [Build a CLI](#️-build-your-own-cli) • [API Reference](#-api-reference)

</div>

## 🌟 Features

- 🎯 **Whose-move bands** — every tab splits into `Your move` and `Their move`, so the two rows you can act on stop hiding among the eighteen you can't
- 🧭 **Standing, not guesswork** — the same `✗` is your afternoon on a PR you wrote and the author's on one you were asked to review; the band knows which
- 🔍 **`--here` scoping** — resolves the repo from your git remote and scopes every search server-side, so other repos are never fetched at all
- 🎛️ **Pattern filtering** — `--include acme/*,me/acme-*` and `--exclude`, replacing any built-in notion of which repos are "yours"
- 🔌 **Bring your own CI** — GitHub Actions logs are built in; register a drill-in for anything else, or let it open in a browser
- ♿ **Readable without colour** — every state carries its own glyph, so the list survives being piped, logged, or read by someone who can't separate green from orange
- 🪶 **No opinions baked in** — repo ranking, checkout locations and cache lifetime are all supplied by the host; the defaults are empty on purpose

## 🚀 Quick Start

Everything here shells out to the [GitHub CLI](https://cli.github.com), so before anything else:

- **`gh` installed and authenticated** — `gh auth login`. Every fetch and every action runs through it, and an unauthenticated `gh` is the most likely reason a first run shows nothing.
- **Node 22 or newer.**
- A terminal that renders the glyphs you choose to pass it. Nothing here requires a Nerd Font — the defaults are plain — but a host that supplies one will want a font that has it.

```sh
npm install @kud/gh-cockpit
```

It is a library, not a CLI — there is no `bin`, because which searches become tabs and which repos rank first are not portable decisions. You write a short entry point; see [Build your own CLI](#️-build-your-own-cli) for a complete one.

What it renders:

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

## 🛠️ Build your own CLI

The package has no `bin`, so this is the file you write. It is short — fetch, assemble, render — and everything opinionated lives in it rather than in the package.

```tsx
#!/usr/bin/env node
import { $ } from "zx"
import React from "react"
import { render } from "ink"
import {
  App,
  buildInboxQuery,
  configureInbox,
  detailFor,
  layoutGHItems,
  signalPath,
  toGHItem,
  withRetry,
  type Section,
} from "@kud/gh-cockpit"

$.verbose = false

// Everything the library refuses to assume. Call once, before rendering.
configureInbox({
  repoPriority: ["acme/monorepo", "acme/", "me/"],
  checkoutDir: `${process.env.HOME}/src`,
  cacheNamespace: "my-cockpit",
  cacheTtlMs: 20 * 60_000,
})

// One GraphQL round trip for every tab. `withRetry` matters: GitHub returns 502
// under load, and a 502 is the server declining to compute an answer, not an answer.
const fetchCockpit = async (): Promise<{ sections: Section[]; login: string }> => {
  const result = await withRetry(() =>
    $`gh api graphql -f query=${buildInboxQuery({})}`.quiet(),
  )
  const data = JSON.parse(result.stdout).data

  const rows = (nodes: any[], standing?: "authored" | "queued" | "spoken") =>
    (nodes ?? []).map((n) => ({ ...toGHItem(n), ...(standing ? { standing } : {}) }))

  return {
    login: data.viewer.login,
    sections: [
      {
        id: "mine",
        label: "Mine",
        items: layoutGHItems(rows(data.myPRs.nodes, "authored"), "mine"),
      },
      {
        // Two searches, one tab. `standing` is stamped per search because nothing
        // on a row can tell them apart afterwards.
        id: "review",
        label: "Review",
        items: layoutGHItems(
          [
            ...rows(data.reviewRequests.nodes, "queued"),
            ...rows(data.reviewed.nodes, "spoken"),
          ],
          "review",
        ),
      },
      { id: "done", label: "Done", items: layoutGHItems(rows(data.recentlyDone.nodes), "done") },
    ].filter((s) => s.items.some((i) => i.kind !== "repo-header")),
  }
}

render(
  <App
    fetcher={fetchCockpit}
    cacheKey="cockpit"
    title="cockpit"
    detailFor={detailFor}
    tabHelp={[
      ["Mine", "your PRs, draft and open"],
      ["Review", "theirs — asked of you, or you reviewed"],
      ["Done", "your PRs closed < 14d"],
    ]}
    emptyHint="Nothing open across your repos."
    watchPath={signalPath()}
    watchDebounceMs={2_000}
  />,
  { alternateScreen: true },
)
```

Point a `bin` at it in your own `package.json` and it is a command.

### Refreshing without polling

`watchPath` is a file the cockpit watches; writing a byte to it makes every open cockpit refetch, debounced. Have whatever mutates GitHub on your behalf — a merge script, an editor hook — write to `signalPath()`.

A poller is wrong twice over: it spends quota on the long stretches where nothing changed, and it is still up to a full interval late when something did. The filesystem is the whole broker — no daemon, no socket, and the fan-out is free.

> [!IMPORTANT]
> Write a byte rather than `touch`ing. At second-granularity mtime with no size change, two touches inside the same second are indistinguishable and some watch backends coalesce them away.

## 📖 API Reference

| Export                                   | Purpose                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `defineCockpit(config)` | Types your own config object. A convenience for hosts — nothing internal reads it |
| `configureInbox(config)`                 | Host opinions: `repoPriority`, `profiles`, `checkoutDir`, `cacheNamespace`, `cacheTtlMs` |
| `parseArgs(argv)` | Parses `--here`, `--include`, `--exclude` and a positional filter name. You decide what they mean |
| `registerCheckDrills(drills)`            | Where a CI check drills in; unregistered checks open in a browser                        |
| `registerPrompts(forms)`                 | What a delegated agent is told to do. Nothing registered means the agent starts cold, and `y` copies the row URL |
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

## 🏗️ Tech Stack

|                                                          |                                                    |
| -------------------------------------------------------- | -------------------------------------------------- |
| [@kud/gh](https://www.npmjs.com/package/@kud/gh)         | Surface-agnostic core: queries, health computation |
| [@kud/gh-ink](https://www.npmjs.com/package/@kud/gh-ink) | Ink components, whose-move banding, layout         |
| [@kud/ink-ui](https://www.npmjs.com/package/@kud/ink-ui) | Terminal UI primitives                             |
| [zx](https://www.npmjs.com/package/zx)                   | Shelling out to `gh`                               |

---

MIT © [kud](https://github.com/kud) — Made with ❤️
