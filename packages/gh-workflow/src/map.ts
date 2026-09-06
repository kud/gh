// GraphQL node → row. Sat in @kud/gh-cockpit next to signalPath(), which
// mkdirSync-es a cache directory — so importing the mapper touched the
// filesystem. It does not any more.

import {
  computeHealth as deriveHealth,
  latestChecks,
  isPassCheck,
  isFailCheck,
  isPendingCheck,
} from "@kud/gh/health"
import { relativeTime, type GHDetail, type GHItem } from "./core.js"
import type { Health } from "@kud/gh/health"

/*
 * The node → ComputeHealthInput adapter, and it is load-bearing.
 *
 * `deriveHealth` takes a transport-agnostic shape; a GraphQL node keeps its
 * checks under `statusCheckRollup.contexts.nodes` and its threads under
 * `reviewThreads.nodes`. Handing the raw node straight to it throws "checks is
 * not iterable" on the first PR that has any checks at all.
 *
 * This lived in @kud/gh-cockpit and was left behind when toGHItem moved here —
 * which shipped a toGHItem that throws on real data, in a release whose tests
 * only ever asserted what the package IMPORTS. Behaviour needs a test with a
 * real node shape, which is what map.test.ts now is.
 */
export const computeHealth = (node: any): Health =>
  deriveHealth({
    state: node.state,
    isDraft: "isDraft" in node ? node.isDraft : undefined,
    checks: node.statusCheckRollup?.contexts?.nodes ?? [],
    mergeable: node.mergeable,
    reviewDecision: node.reviewDecision,
    unresolvedThreads: ((node.reviewThreads?.nodes ?? []) as any[]).filter(
      (t) => t && !t.isResolved,
    ).length,
  })

const viewerReacted = (n: any, content: string): boolean =>
  ((n?.reactionGroups ?? []) as any[]).some(
    (g) => g?.content === content && g?.viewerHasReacted,
  )

const conversationOf = (
  node: any,
): { count: number; lastActor?: string; lastEventAt?: string } => {
  // `acked` is only ever set on the PR-level comments, because they are the only
  // events @kud/gh fetches reactions for. Reviews and thread replies carry none
  // and read as unacked, which is the safe direction: an ack that cannot be seen
  // leaves the turn where it was rather than clearing one nobody claimed.
  const events: Array<{
    at: string
    login?: string
    bot: boolean
    acked?: boolean
  }> = []
  let count = node.comments?.totalCount ?? 0
  const isBot = (author: any) => author?.__typename === "Bot"

  for (const c of node.comments?.nodes ?? [])
    events.push({
      at: c.createdAt,
      login: c.author?.login,
      bot: isBot(c.author),
      acked: viewerReacted(c, "EYES"),
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
  const answeredByPush = Boolean(last?.bot && pushedAt && pushedAt > last.at)
  // An ack moves no clock: unlike a push it is not an event with a time of its
  // own here, so the comment it settles stays the last thing that happened and
  // the row keeps reading as active. Only the turn changes.
  if (answeredByPush || last?.acked)
    return {
      count,
      lastActor: node.author?.login,
      lastEventAt: answeredByPush ? pushedAt : last?.at,
    }

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

// `labels` moved onto GHItem itself once the row learned to draw it — the row
// is where it was always headed, and a host-side widening was the shape of a
// field the library did not know about. Kept as an alias because it is on the
// public surface and the name reads better at cockpit's call sites.
export type CockpitItem = GHItem

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
    // 👍 on the PR BODY, and the anchor is load-bearing rather than incidental.
    // Scoped to a comment this would quietly evaporate on the next bot comment,
    // which is exactly backwards for something meant to persist — anchoring it
    // on the PR makes it PR-scoped by construction, with no bookkeeping to get
    // wrong. It also reads distinctly on GitHub itself: an eye down in the
    // thread, a thumb at the top.
    //
    // Precedence over 👀 comes for free: the pin is read by whoseMove, which
    // answers before anything derived from lastActor is consulted. Nobody pins
    // by accident, so the pin wins.
    pinned: viewerReacted(node, "THUMBS_UP"),
    labels: (node.labels?.nodes ?? [])
      .map((l: any) => l?.name)
      .filter((n: unknown): n is string => typeof n === "string"),
    detail: detailOf(node, convo.lastEventAt),
    indent: opts.indent ?? false,
  }
}
