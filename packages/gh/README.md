# @kud/gh

Surface-agnostic GitHub core. Shells out to the `gh` CLI and returns plain data —
consumed by CLIs, Ink dashboards, and MCP servers alike. No UI, no framework.

## Install

```sh
npm install @kud/gh
```

Requires the [`gh`](https://cli.github.com) CLI, authenticated (`gh auth login`).

## API

### Transport primitives

```ts
import { ghGraphql, ghRest } from "@kud/gh"

const data = await ghGraphql<T>(query, { owner: "kud", name: "gh", number: 1 })
const raw = await ghRest("repos/kud/gh/pulls/1/comments", {
  method: "POST",
  fields: { body: "hi", in_reply_to: 123 },
})
```

`ghGraphql` returns the unwrapped `data` field; `ghRest` returns raw stdout.
String fields pass as `-f`, numbers as `-F` (typed-field), matching `gh api`.

### PR review comments

```ts
import {
  fetchPrComments,
  replyToThread,
  resolveThread,
  unresolveThread,
} from "@kud/gh"

const { headRef, conversation, threads } = await fetchPrComments("kud", "gh", 1)
await replyToThread({
  repo: "kud/gh",
  pull: 1,
  inReplyTo: 123,
  body: "thanks!",
})
await resolveThread(thread.id) // → boolean isResolved
await unresolveThread(thread.id)
```

Types: `PrComments`, `ReviewThread`, `Comment`, `ReplyToThreadOptions`.

## Development

```sh
npm run typecheck
npm run test
npm run build
```

## Licence

MIT © Erwann Mest
