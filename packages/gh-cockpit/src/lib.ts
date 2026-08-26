// The cockpit's shared layer: everything a GitHub PR/issue surface needs that is
// not itself a view. Re-exports @kud/gh-ink wholesale so a consumer imports from
// one place, and adds the few things the library deliberately does not own — the
// GraphQL node → row mapping, health computation, and a transient-failure retry.
//
// Anything that knows about a specific machine, employer or CI system belongs to
// the HOST, not here: `configureInbox`, `registerCheckDrills` and the repo
// filters are how a host says those things.

export * from "@kud/gh-ink"

import { $ } from "zx"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import {
  inboxConfig,
  relativeTime,
  type GHDetail,
  type GHItem,
  type Section,
} from "@kud/gh-ink"
import {
  type Health,
  buildInboxQuery,
  computeHealth as ghComputeHealth,
  latestChecks,
  isPassCheck,
  isFailCheck,
  isPendingCheck,
} from "@kud/gh"

export { buildInboxQuery }

export const withRetry = async <T,>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000,
): Promise<T> => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = (err as Error).message ?? ""
      const isTransient = /50[234]/.test(msg)
      if (!isTransient || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
    }
  }
  throw new Error("unreachable")
}

export const computeHealth = (node: any): Health =>
  ghComputeHealth({
    state: node.state,
    isDraft: "isDraft" in node ? node.isDraft : undefined,
    checks: node.statusCheckRollup?.contexts?.nodes ?? [],
    mergeable: node.mergeable,
    reviewDecision: node.reviewDecision,
    unresolvedThreads: ((node.reviewThreads?.nodes ?? []) as any[]).filter(
      (t) => t && !t.isResolved,
    ).length,
  })

// Every state has a distinct GLYPH — colour only reinforces, never distinguishes
// (kud is colourblind; two markers that share a shape and differ by colour are
// indistinguishable). So no two rows share a symbol.
// `none` is an issue: it has no review state, so it used to render a blank
// cell — an absence that read as missing data rather than as "this is an
// issue". nf-oct-issue_opened says it positively, in the column that was
// already reserved, which matters most in Assigned where PRs and issues mix.

// Who spoke last, across every surface an item can be spoken on: the
// conversation, a submitted review, and each thread's latest reply. Deliberately
// event-based rather than count-based — a count says a discussion happened, and
// the thing you actually need to know is whether the next move is yours.
// PENDING reviews are excluded: they're unsubmitted drafts nobody else can see.
//
// A push answers a machine, and does not answer a person. A review bot re-reads
// the diff on every push, so requiring words to clear its turn is a treadmill:
// you reply, you push, it reviews again, and the arrow is back. A person is owed
// words. So when a Bot holds the last word and a commit landed after it, the
// push IS the reply and the author is who spoke last. Bots stay fully visible —
// the row, the thread, the comment — they just stop claiming a turn you have
// already taken. Bot-ness comes from `__typename`, not the login: GraphQL
// reports app authors bare (`greptile-apps`), so a machine ACCOUNT such as
// `raycastbot` is a User here and still reads as human.
const conversationOf = (
  node: any,
): { count: number; lastActor?: string; lastEventAt?: string } => {
  const events: Array<{ at: string; login?: string; bot: boolean }> = []
  let count = node.comments?.totalCount ?? 0
  const isBot = (author: any) => author?.__typename === "Bot"

  for (const c of node.comments?.nodes ?? [])
    events.push({
      at: c.createdAt,
      login: c.author?.login,
      bot: isBot(c.author),
    })
  for (const r of node.reviews?.nodes ?? [])
    if (r.state !== "PENDING")
      events.push({
        at: r.submittedAt,
        login: r.author?.login,
        bot: isBot(r.author),
      })
  for (const t of node.reviewThreads?.nodes ?? []) {
    count += t.comments?.totalCount ?? 0
    for (const c of t.comments?.nodes ?? [])
      events.push({
        at: c.createdAt,
        login: c.author?.login,
        bot: isBot(c.author),
      })
  }

  const last = events
    .filter((e) => e.at)
    .sort((a, b) => a.at.localeCompare(b.at))
    .pop()

  // Only the LAST event needs testing: a push later than it is later than every
  // event before it too. ISO-8601 UTC compares lexicographically, the same trick
  // the stall test in @kud/gh-ink already relies on.
  const pushedAt = node.commits?.nodes?.[0]?.commit?.committedDate
  if (last?.bot && pushedAt && pushedAt > last.at)
    return { count, lastActor: node.author?.login, lastEventAt: pushedAt }

  return { count, lastActor: last?.login, lastEventAt: last?.at }
}

const detailOf = (node: any, lastEventAt?: string): GHDetail => {
  const active = latestChecks(node.statusCheckRollup?.contexts?.nodes ?? [])
  return {
    reviewDecision: node.reviewDecision ?? undefined,
    mergeable: node.mergeable ?? undefined,
    checksPass: active.filter(isPassCheck).length,
    checksFail: active.filter(isFailCheck).length,
    checksPending: active.filter(isPendingCheck).length,
    threadsTotal: (node.reviewThreads?.nodes ?? []).length,
    lastCommitAt: node.commits?.nodes?.[0]?.commit?.committedDate,
    lastEventAt,
  }
}

export type CockpitItem = GHItem & { labels?: string[] }

export const toGHItem = (
  node: any,
  opts: { indent?: boolean } = {},
): CockpitItem => {
  const completedAt = node.mergedAt ?? node.closedAt ?? node.createdAt
  const convo = conversationOf(node)

  // What "last activity" means, and it is deliberately NOT GitHub's `updatedAt`.
  // That field bumps on label and assignee churn, so a triage pass would float
  // every issue it touched above a PR someone had actually replied to. These
  // three are the events a human would call activity, and every one of them is
  // already in the response — conversationOf folds the last comment, review and
  // thread reply into lastEventAt, and the last commit rides along beside it. So
  // this costs nothing: no extra field, no extra node, no extra GraphQL points.
  //
  // Compared as ISO-8601 UTC strings rather than parsed, the same lexicographic
  // trick conversationOf above already relies on.
  const activityAt = [
    node.createdAt,
    convo.lastEventAt,
    node.commits?.nodes?.[0]?.commit?.committedDate,
  ]
    .filter(Boolean)
    .sort()
    .pop()

  // Done rows sort and read by completion — that is their recency, and the
  // recentlyDone fragment fetches no conversation to derive anything else from.
  // Everywhere else the item is open, so `age` stays the opening date and
  // activity is the new, separate value.
  const isDone = Boolean(node.mergedAt ?? node.closedAt)
  const sortAt = isDone ? completedAt : (activityAt ?? completedAt)
  return {
    // Prefer GraphQL's own discriminator; fall back to field-presence only when
    // a fragment omitted __typename. Field-presence alone mislabels PRs as issues
    // whenever a fragment (reviewRequests, assigned, reviewed…) skips isDraft /
    // headRefName — which sent PR drills to the issues endpoint.
    kind:
      node.__typename === "PullRequest"
        ? "pr"
        : node.__typename === "Issue"
          ? "issue"
          : "isDraft" in node || "headRefName" in node
            ? "pr"
            : "issue",
    number: node.number,
    title: node.title ?? "",
    repo: node.repository?.nameWithOwner ?? "",
    url: node.url ?? "",
    branch: node.headRefName,
    health: computeHealth(node),
    author: node.author?.login,
    age: completedAt ? relativeTime(completedAt) : "",
    activityAge: !isDone && activityAt ? relativeTime(activityAt) : undefined,
    ts: sortAt ? new Date(sortAt).getTime() : 0,
    unresolved: ((node.reviewThreads?.nodes ?? []) as any[]).filter(
      (t) => t && !t.isResolved,
    ).length,
    conversation: convo.count,
    lastActor: convo.lastActor,
    labels: (node.labels?.nodes ?? [])
      .map((l: any) => l?.name)
      .filter((n: unknown): n is string => typeof n === "string"),
    detail: detailOf(node, convo.lastEventAt),
    indent: opts.indent ?? false,
  }
}

export const signalPath = (): string => {
  const dir = join(
    process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
    inboxConfig().cacheNamespace,
  )
  mkdirSync(dir, { recursive: true })
  return join(dir, "cockpit-dirty")
}
