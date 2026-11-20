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

### Health

```ts
import { computeHealth, fetchHealth } from "@kud/gh"

const token = computeHealth({
  state: "OPEN",
  isDraft: false,
  checks, // PrCheck[], normalised from whichever transport you used
  mergeable: "MERGEABLE",
  reviewDecision: "APPROVED",
  unresolvedThreads: 0,
}) // → Health
const data = await fetchHealth("kud/gh", 1) // → PrHealthData, what a detail panel renders
```

`computeHealth` collapses a PR to one semantic token, first match wins:
`merged`, `closed`, `none` (no draft flag to read — an issue), `draft`,
`ci-fail`, `conflict`, `changes-req`, `threads`, `pending`, `approved`,
`waiting`. The core picks the token; colour and glyph belong to the surface.

Four predicates partition GitHub's check conclusions — `isFailCheck`,
`isPendingCheck`, `isInconclusiveCheck`, `isPassCheck`. A cancelled or stale run
is inconclusive, not a failure: no verdict on the code was reached.
`latestChecks` keeps the newest run per check.

### Inbox and pulse

```ts
import { fetchInbox, buildInboxQuery, buildPulseQuery, pulseFingerprint } from "@kud/gh"
```

`fetchInbox(options)` runs every source behind a dashboard in parallel, merges
them, and pages `myPRs` past its first window (25 a page, up to 20 pages).
`buildInboxQuery`, `buildInboxQueries` and `mergeInboxData` are the pieces
underneath it. Sources: `myPRs`, `reviewRequests`, `reviewed`, `assigned`,
`repoIssues`, `authoredIssues`, `repoPRs`, `recentlyDone`, plus five asked for by
name only — `repoIssuesUnassigned`, `repoIssuesAssigned`,
`authoredIssuesUnassigned`, `authoredIssuesAssigned`, `othersDone`.
`SOURCE_LIMITS`, `sourceCoverage` and `cappedSources` let a truncated source say
so rather than truncate silently. `fetchItemNode(repo, number)` fetches one PR
or issue node.

`buildPulseQuery` is the cheap question asked between full reads — about one
rate-limit point — and `pulseFingerprint` reduces its answer to a string.
Compare it with the last one and pay for a full read only when it differs.

### Actions and references

```ts
import { mergePr, rerunFailedRun, reRequestReviewer } from "@kud/gh"
import { parseRef, formatRef } from "@kud/gh/ref"
```

`mergePr` merges with a merge commit, `rerunFailedRun` re-runs only the failed
jobs of an Actions run, `reRequestReviewer` adds a reviewer back.
`resolveCurrentPr()` and `resolveCurrentRepo()` read the branch or repo you are
standing in. `parseRef` reads a github.com URL, `owner/repo#1` or a bare `#1`,
and returns `null` for anything else.

### Webhooks

`fetchHooks`, `findHook` (by url substring or hook id), `findJenkinsHook`,
`fetchLatestPrDeliveryId`, `replayDelivery`, `replayLatestPrDelivery` and
`retriggerJenkinsWebhook` — what `gh-webhook-replay` and
`gh-pr-health --retrigger` run on.

### Subpaths

`@kud/gh/health` and `@kud/gh/ref` import nothing else, so transport-free code
can take a single concern without pulling in `execa`. `@kud/gh/inbox` and
`@kud/gh/pulse` are narrower entry points, not transport-free ones: they reach
`gh` through `ghGraphql`.

## Development

```sh
npm run typecheck
npm run test
npm run build
```

## Licence

MIT © Erwann Mest
