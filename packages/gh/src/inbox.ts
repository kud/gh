// The inbox query — "what is on my plate": my PRs, review requests, reviews I
// have given, assigned work, issues and PRs on my repos, and what I closed
// recently.
//
// Query-only by design. Assembling the result into sections is the surface's
// own vocabulary — cockpit splits home from work, a web dashboard may group by
// project — so nothing here decides what a section is.

/**
 * How much of each row to ask for.
 *
 * `full` carries health, conversation and labels — everything `computeHealth`
 * and a conversation line need. `minimal` carries identity only: type, number,
 * title, url, draft, timestamp, repo.
 *
 * This is a cost axis, not a taste one. Measured against GitHub's own
 * `rateLimit { cost }` while the review-thread window was still `first: 50`:
 * the full query cost **73 points** of a 5000/hour budget, at a nodeCount of
 * ~16,870 — because `statusCheckRollup.contexts` appears in five PR fragments
 * and `reviewThreads` multiplies beneath each one. A caller that renders a
 * title and a link was paying for every check run on every open PR. That
 * window is `first: 10` now and the same document measures 34 points, but the
 * axis is unchanged: the multiplication is what `minimal` exists to drop.
 */
/**
 * How many of your own open PRs to ask for.
 *
 * This is the single biggest lever on the query's cost, because connections
 * MULTIPLY: the health and conversation fragments hang ~50 nodes off each PR
 * (`reviewThreads(first: 10)` at two nodes a thread,
 * `statusCheckRollup.contexts(first: 20)`, `labels(first: 10)`), so the outer
 * number is a multiplier on all of them.
 * GitHub scores a call by the nodes it could return, not by how many calls you
 * make — which is why splitting the query across requests costs the same, and
 * this saves a lot.
 *
 * It was 100, against ~25,550 total nodes and a measured 111 points. 100 × 80 is
 * 8,000 of those nodes from this one search, and it was 100 for no reason beyond
 * the search API's own maximum — every other search here already asks for 20-30.
 * At 30 this search costs 2,400 nodes instead of 8,000, roughly halving the whole
 * query.
 *
 * `issueCount` is fetched alongside so the cap can never drop rows in silence: a
 * scalar costs nothing, and a host that knows the true total can say what it is
 * not showing.
 */
export const MY_PRS_LIMIT = 30

/**
 * How many rows each source asks for — the cap, as DATA rather than a literal
 * buried in eight query strings.
 *
 * It has to be readable from outside, because a cap you cannot compare against
 * `issueCount` is a cap that truncates in silence. Measured 2026-09-07 on a real
 * account: `assigned` 37 rows against 30, `repoIssues` 94 against 30,
 * `authoredIssues` 95 against 30. Two sources showing under a third of what they
 * matched, and nothing anywhere said so.
 *
 * That silence is not merely a display gap. A surface that diffs one fetch
 * against the next reads a row leaving the WINDOW as a row leaving the WORLD, so
 * every update to any of those 95 issues evicted something and was reported as
 * news about the evicted one. See `sourceCoverage`.
 *
 * THE NUMBERS ARE NOT ONE NUMBER, because a row is not one weight. 30 was set
 * for PULL REQUESTS and the issue sources inherited it, which is how a cap sized
 * against `reviewThreads(first: 50)` came to govern a row carrying
 * `comments(last: 1)` and ten labels. A PR drags roughly 50 nested nodes — it
 * was 80 while the thread window was `first: 50`; an issue drags about 12.
 *
 * Measured 2026-09-07, same account, same selections that actually ship:
 *
 *   repoIssues  first:30   cost 1   360 nodes
 *   repoIssues  first:100  cost 2  1200 nodes   ← every issue he has
 *   assigned    first:100  cost 2  6100 nodes   (mixed source, see below)
 *   the real 2-source batch at first:100: cost 4, 2400 nodes, 5.3s
 *
 * So showing every issue costs about three points a fetch, against a 5000/hour
 * budget and a 10-minute cache — six fetches an hour, call it 0.4% of budget.
 * The cap was never buying anything on these three.
 *
 * WHAT IT DOES SPEND is headroom against the proxy, which fails on WALL CLOCK
 * rather than cost: eight sources at ~16,870 nodes 502s two runs in three. The
 * batch above is 2,400 nodes and 5.3s, roughly a seventh of that, which is why
 * this is safe today rather than merely cheap. If 502s start appearing, this is
 * the first thing to put back, and it is one constant.
 *
 * `assigned` is the one to watch: it is a MIXED source, so a PR assigned to you
 * arrives with the full health fragment behind it. Today it returns 38 rows and
 * no PRs, but its node count is budgeted for the PR shape whatever comes back —
 * hence 6,100 for 38 rows. A day spent with fifty PRs assigned would make this
 * the heaviest search in the query.
 *
 * The PR sources keep their caps. There the outer number really does multiply
 * ~80 nested nodes, and `myPRs` at 30 is already half the cost of the whole call.
 */
export const SOURCE_LIMITS: Record<InboxSource, number> = {
  myPRs: MY_PRS_LIMIT,
  reviewRequests: 20,
  reviewed: 20,
  assigned: 100,
  repoIssues: 100,
  authoredIssues: 100,
  repoPRs: 30,
  recentlyDone: 30,
}

export type InboxShape = "full" | "minimal"

/** One search in the inbox, addressable by the alias it answers under. */
export type InboxSource =
  | "myPRs"
  | "reviewRequests"
  | "reviewed"
  | "assigned"
  | "repoIssues"
  | "authoredIssues"
  | "repoPRs"
  | "recentlyDone"

/** Every source, in the order a whole-inbox query asks for them. */
export const INBOX_SOURCES: readonly InboxSource[] = [
  "myPRs",
  "reviewRequests",
  "reviewed",
  "assigned",
  "repoIssues",
  "authoredIssues",
  "repoPRs",
  "recentlyDone",
]

/** A repo-scoped or account-wide inbox. */
export type InboxQueryOptions = {
  /** `owner/name`. Scopes every search to one repository. */
  repo?: string
  /** How far back `recentlyDone` looks. Defaults to 14 days. */
  doneWithinDays?: number
  /**
   * Defaults to `full`, so every existing caller keeps what it had. Reach for
   * `minimal` only when nothing downstream reads health, conversation or
   * labels — those fields do not degrade, they vanish, and `computeHealth`
   * falls through to a wrong answer rather than an absent one.
   */
  shape?: InboxShape
  /**
   * Which sources to ask for. Defaults to all of them.
   *
   * Every query is still a complete, valid document — `rateLimit` and `viewer`
   * ride along with any subset — so a caller can split the inbox across
   * requests without the parts becoming fragments that only mean something
   * reassembled.
   */
  sources?: readonly InboxSource[]
  /**
   * Per-source overrides for `SOURCE_LIMITS`. Anything left out keeps its
   * default, so this is purely additive and a caller that passes nothing gets
   * exactly the query it got before.
   *
   * It exists because the cap and the SHAPE are one decision and were split
   * across two scopes: `shape` is a per-call option and `SOURCE_LIMITS` is a
   * module constant, so "ask for a hundred rows of the cheap fragment" — the one
   * combination that answers — could not be spelled from outside this file.
   *
   * That combination is the whole point. Measured 2026-09-08 on a live account,
   * `reviewRequests` against 99 matching rows:
   *
   *   full     first: 20    11 pts   ~2s    200
   *   full     first: 50    28 pts   7.9s   200
   *   full     first: 100      —     ~11s   502, twice
   *   minimal  first: 100    1 pt    2.1s   200
   *
   * The 502 is the search timing out at GitHub's proxy rather than a node-count
   * refusal — cutting the review-thread window by 65% still 502s at ~11s — so
   * `first: 50` is the ceiling with a foot over the line, and a full fragment
   * cannot reach 99 at any window. A two-tier fetch can: the full shape at the
   * default cap for the rows that get a verdict, then `{ shape: "minimal",
   * limits: { reviewRequests: 100 } }` for the rest.
   *
   * A caller doing that owes the overflow rows an honest verdict. A minimal row
   * carries no health, and health absent is not health `waiting` — see
   * `computeHealth`'s note on why this set is all-or-nothing, and
   * `@kud/gh-workflow`'s `whoseMove`, which answers `unknown` rather than
   * guessing.
   */
  limits?: Partial<Record<InboxSource, number>>
}

/**
 * The cap each source will actually ask for, defaults merged with the caller's
 * overrides.
 *
 * Floored and clamped to at least 1 rather than trusted: GitHub rejects
 * `first: 0` and a fractional `first` outright, so a bad number would cost a
 * whole query rather than a few rows. Capped at 100, the search API's own
 * maximum, for the same reason — asking for 200 fails the document, it does not
 * return 200.
 */
export const limitsFor = (
  options: InboxQueryOptions = {},
): Record<InboxSource, number> => {
  const merged = { ...SOURCE_LIMITS }
  for (const source of INBOX_SOURCES) {
    const asked = options.limits?.[source]
    if (typeof asked === "number" && Number.isFinite(asked))
      merged[source] = Math.min(100, Math.max(1, Math.trunc(asked)))
  }
  return merged
}

// computeHealth's precedence needs reviewDecision, mergeable and the check
// rollup. A fragment that omits them does NOT degrade gracefully — it falls
// straight through to whatever token is left, so a PR you already sent back
// renders as "awaiting review" and a failing one renders as quiet.
//
// So this set is all-or-nothing, which is exactly why `shape` drops it whole
// rather than field by field: a caller either computes health and needs every
// one of these, or renders none of it and should pay for none of it. There is
// no coherent middle, and the `minimal` shape is not a smaller health — it is
// the absence of health.
//
// `isDraft` is deliberately NOT in here. It is identity, not health, and a
// minimal caller still has to tell a draft from an open PR, so it sits in the
// base field list beside `number` and `title` where dropping health cannot
// take it with them.
const PR_HEALTH = `
      reviewDecision mergeable
      statusCheckRollup { contexts(first: 20) { nodes {
        ... on CheckRun { name conclusion status }
        ... on StatusContext { context state }
      } } }`

// Whose turn it is cannot be read off a count, so every comment-bearing edge
// carries its latest author and timestamp: the conversation, the review bodies,
// and each thread's last reply. The last commit rides along so a consumer can
// say whether the author has pushed since being sent back.
//
// `__typename` distinguishes a Bot from a User, which a login cannot: GraphQL
// reports app authors bare (`greptile-apps`), without the `[bot]` suffix REST
// adds, so there is nothing in the name to match on. A consumer needs it to
// decide whether a push answers what was said — it does when a machine said it,
// and does not when a person did. Note it catches GitHub Apps only; a machine
// ACCOUNT like `raycastbot` is a User and reads as human here.
//
// A reaction of the viewer's OWN is the third thing that can settle a turn,
// after words and a push, and `viewerHasReacted` is the whole of what a
// consumer needs to see it. The count is deliberately not selected: nobody asks
// how many, and `users` is the only sub-selection here that would be a
// connection and want a pagination argument. `reactionGroups` itself is a plain
// list of the eight content types, returned whether or not anyone reacted, so
// this buys no nodes — a PR carrying both selections measures at cost 1.
//
// Two levels, because the two directions a reaction can point are scoped
// differently and have to be. On the last comment it can only speak for that
// comment, so a newer one undoes it; on the PR it speaks for the PR, where no
// later comment should quietly erase it. Thread comments get neither:
// `reviewThreads` is a window on every PR source at once, and eight more fields
// ten times over is exactly the multiplication the budget note above exists to
// prevent.
//
// THE WINDOW IS THE DOMINANT COST ON EVERY PR-BEARING SOURCE, because it
// multiplies beneath five searches at once. It was `first: 50` because fifty is
// a round number, and nothing measured what a PR actually carries. Measured
// 2026-09-09 on a live account, the whole inbox query, same selections that
// ship:
//
//   reviewThreads(first: 50)   cost 114   27,230 nodes
//   reviewThreads(first: 20)   cost  54   15,230 nodes
//   reviewThreads(first: 10)   cost  34   11,230 nodes
//
// Against 5,000 points an hour that is 44 loads versus 147. And the data never
// justified fifty: across 13 PR rows on that account the deepest carried TWO
// threads and the median carried none — nothing above ten, on either PR source.
//
// `totalCount` is what makes narrowing safe rather than merely cheap. A window
// smaller than the world is the same trap `sourceCoverage` exists for one level
// up, and the scalar costs nothing: a consumer comparing it against
// `nodes.length` knows whether it is holding the threads or a sample of them,
// instead of counting what came back and calling that the total. Note the
// coverage it buys is on the COUNT — `isResolved` beyond the window is still
// unseen, so a PR carrying eleven threads can still under-report unresolved
// ones to `computeHealth`. That is the direction to fail in and the reason the
// window keeps five times the observed maximum rather than two.
const PR_CONVERSATION = `
      reactionGroups { content viewerHasReacted }
      comments(last: 1) { totalCount nodes { author { __typename login } createdAt reactionGroups { content viewerHasReacted } } }
      reviews(last: 1) { nodes { author { __typename login } state submittedAt } }
      reviewThreads(first: 10) { totalCount nodes {
        isResolved
        comments(last: 1) { totalCount nodes { author { __typename login } createdAt } }
      } }
      commits(last: 1) { nodes { commit { committedDate } } }`

const ISSUE_CONVERSATION = `
      comments(last: 1) { totalCount nodes { author { __typename login } createdAt } }`

// Fetched so a consumer can tell a `plan` issue from any other — which decides
// what a delegated session gets handed. Nothing here renders labels.
const ISSUE_LABELS = `
      labels(first: 10) { nodes { name } }`

/*
 * Computed per call, never at module scope. A CLI process is short-lived and
 * would not notice, but a long-running server imports this once and keeps it
 * for days — a module-level date would freeze "recently done" to the morning
 * the server booted and quietly stop reporting anything closed since.
 */
const sinceDay = (days: number) =>
  new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10)

/** Everything a source's text interpolates, resolved once per call. */
type Selections = {
  scope: string
  owned: string
  doneSince: string
  health: string
  conversation: string
  issueConversation: string
  issueLabels: string
}

/*
 * One entry per source, keyed by the alias it answers under, so a caller can
 * ask for any subset without this file growing a second copy of the query text.
 * Each value is the whole `alias: search(…) { … }` selection, indented as it
 * appears in the document.
 */
const SOURCES: Record<InboxSource, (s: Selections, first: number) => string> = {
  myPRs: (
    { scope, health, conversation },
    first,
  ) => `  myPRs: search(query: "${scope}is:pr is:open author:@me", type: ISSUE, first: ${first}) {
    issueCount
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  reviewRequests: (
    { scope, health, conversation },
    first,
  ) => `  reviewRequests: search(query: "${scope}is:pr is:open review-requested:@me", type: ISSUE, first: ${first}) {
    issueCount
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  reviewed: (
    { scope, health, conversation },
    first,
  ) => `  reviewed: search(query: "${scope}is:pr is:open reviewed-by:@me -author:@me -review-requested:@me", type: ISSUE, first: ${first}) {
    issueCount
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  assigned: (
    { scope, health, conversation, issueConversation, issueLabels },
    first,
  ) => `  assigned: search(query: "${scope}is:open assignee:@me", type: ISSUE, first: ${first}) {
    issueCount
    nodes {
      __typename
      ... on Issue {
        number title createdAt url repository { nameWithOwner } author { login }
        ${issueConversation}
        ${issueLabels}
      }
      ... on PullRequest {
        number title createdAt url headRefName isDraft repository { nameWithOwner } author { login }
        ${health}
        ${conversation}
      }
    }
  }`,

  repoIssues: (
    { scope, owned, issueConversation, issueLabels },
    first,
  ) => `  repoIssues: search(query: "${scope}${owned}is:issue is:open archived:false", type: ISSUE, first: ${first}) {
    issueCount
    nodes { __typename ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${issueConversation}
      ${issueLabels}
    }}
  }`,

  /*
   * `-user:@me` is what makes this DISJOINT from `repoIssues`, and it is not an
   * optimisation — it is the thing that makes a merged tab's totals addable.
   *
   * THE INVARIANT, which belongs here and nowhere else: the negations in a
   * merged tab's queries mirror the order `pick` claims rows in. `repoIssues`
   * runs first and takes anything on a repo you own, so this one asks for the
   * remainder — exactly what the host already documents it wants ("issues I
   * filed on repos I don't own") and already achieves at ROW level by deduping.
   * Only `issueCount` never knew, because the query still asked for the superset.
   *
   * `reviewed` has carried the same shape all along (`-review-requested:@me`),
   * which is why `Review` was never wrong and this tab was.
   *
   * Measured 2026-09-07: 94 own-repo issues, 95 authored, 92 of them BOTH — so
   * summing the two `issueCount`s claimed 189 where the truth was 97. Overlap is
   * the normal case, not an edge: a plans repo you own and file into is in both
   * sets by construction. With the negation, 94 + 3 = 97 and the sum is trivially
   * right because the sets cannot intersect.
   *
   * It also fetches BETTER rows for fewer nodes. Without it, 30 rows arrive of
   * which ~27 are duplicates `pick` discards, and the handful of external issues
   * that are this source's entire purpose may not be in that window at all.
   *
   * Add a third source to a merged tab and it takes the negations of every
   * source that claims before it. Measure the overlap instead and you are
   * carrying a second fact that rots silently.
   */
  authoredIssues: (
    { scope, issueConversation, issueLabels },
    first,
  ) => `  authoredIssues: search(query: "${scope}is:issue is:open author:@me -user:@me archived:false", type: ISSUE, first: ${first}) {
    issueCount
    nodes { ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${issueConversation}
      ${issueLabels}
    }}
  }`,

  repoPRs: (
    { scope, owned, health, conversation },
    first,
  ) => `  repoPRs: search(query: "${scope}${owned}is:pr is:open -author:@me archived:false", type: ISSUE, first: ${first}) {
    issueCount
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  recentlyDone: (
    { scope, doneSince },
    first,
  ) => `  recentlyDone: search(query: "${scope}is:pr author:@me -is:open closed:>=${doneSince}", type: ISSUE, first: ${first}) {
    issueCount
    nodes { __typename ... on PullRequest {
      number title state isDraft createdAt mergedAt closedAt url
      repository { nameWithOwner }
    }}
  }`,
}

const selectionsFor = ({
  repo,
  doneWithinDays = 14,
  shape = "full",
}: InboxQueryOptions): Selections => {
  /* Interpolated as empty strings rather than branching the query text, so the
     two shapes cannot drift into two separately-maintained queries. */
  const full = shape === "full"
  return {
    scope: repo ? `repo:${repo} ` : "",
    owned: repo ? "" : "user:@me ",
    doneSince: sinceDay(doneWithinDays),
    health: full ? PR_HEALTH : "",
    conversation: full ? PR_CONVERSATION : "",
    issueConversation: full ? ISSUE_CONVERSATION : "",
    issueLabels: full ? ISSUE_LABELS : "",
  }
}

/**
 * Build the inbox query. Without `repo`, it is account-wide.
 *
 * The two qualifiers do NOT compose. `user:@me` means "in repos I own", and
 * GitHub ANDs search qualifiers — so `user:@me repo:someone-else/x` matches
 * nothing, and a scoped inbox on a repo you contribute to but do not own would
 * render empty and read as "nothing to do here". So `repo:` REPLACES
 * `user:@me` rather than joining it.
 */
/**
 * Which sources this scope should actually ask for.
 *
 * `authoredIssues` earns its place by asking for issues you filed OUTSIDE the
 * repos you own — `-user:@me`, see SOURCES. Under a `repo:` scope there is no
 * outside: `user:@me` is replaced rather than joined (see below), so the
 * negation has nothing to negate and the search degrades to a strict SUBSET of
 * `repoIssues`. Every row it returns is one `pick` immediately discards, paid
 * for on every scoped fetch.
 *
 * Shared by both builders on purpose. They resolved `options.sources`apiece,
 * which is exactly the shape where a change like this half-lands — the
 * single-document path drops the source and the split path goes on asking.
 */
const sourcesFor = (options: InboxQueryOptions): readonly InboxSource[] => {
  const sources = options.sources ?? INBOX_SOURCES
  return options.repo
    ? sources.filter((source) => source !== "authoredIssues")
    : sources
}

export const buildInboxQuery = (options: InboxQueryOptions = {}) => {
  const selections = selectionsFor(options)
  const sources = sourcesFor(options)
  const limits = limitsFor(options)

  /*
   * `rateLimit` is free — it does not count against itself — and it is the only
   * authoritative source for what this query costs. Every estimate made about
   * that on 2026-08-14 was wrong, one of them by 25x, because GraphQL cost is
   * node-count based and nested connections multiply: `reviewThreads(first: 50)`
   * beneath `search(first: 100)` is 5,000 nodes from two lines of query text. A
   * package handing out a query costing tens of points should hand out the
   * means to see it — and it is what proved the window narrowing worked.
   *
   * (GraphQL has no block comments, only `#`, so this note lives out here.)
   */
  return `
{
  rateLimit { cost nodeCount remaining resetAt }
  viewer { login }
${sources.map((source) => SOURCES[source](selections, limits[source])).join("\n")}
}
`
}

/**
 * How many sources to put in one request.
 *
 * GitHub's proxy answers a request, not a query — so the ceiling here is WALL
 * CLOCK, not cost. Measured on 2026-08-28 against an account-wide inbox: the
 * eight-source query returns HTTP 502 on roughly two runs in three, after
 * 10–30s; the same eight sources asked one at a time return 200 every time, for
 * the same 73 points and the same ~16,870 nodes. Adding sources one at a time
 * shows a clean gradient — five is reliable, six starts failing, eight mostly
 * fails.
 *
 * The cost is identical either way, which is the whole reason this is safe:
 * GraphQL scores the nodes a query COULD return, so splitting one document into
 * four buys reliability at no extra budget. It is also why the same query is
 * fine repo-scoped — `repo:` narrows what the search index has to walk, while
 * `author:@me` across an account does not.
 *
 * Two rather than five, because the gradient is a probability and not a cliff:
 * the point is headroom, and four requests in parallel cost the same wall clock
 * as one.
 */
export const INBOX_SOURCES_PER_QUERY = 2

/**
 * Build the inbox as several independent queries, to be issued in parallel and
 * merged with `mergeInboxData`.
 *
 * Prefer this to `buildInboxQuery` for an account-wide inbox. Each query is a
 * complete document carrying its own `rateLimit` and `viewer`, so a partial
 * failure is one source missing rather than a malformed whole.
 */
export const buildInboxQueries = (
  options: InboxQueryOptions & { sourcesPerQuery?: number } = {},
): string[] => {
  const { sourcesPerQuery = INBOX_SOURCES_PER_QUERY, ...queryOptions } = options
  const sources = sourcesFor(options)
  const size = Math.max(1, Math.trunc(sourcesPerQuery))

  const chunks: InboxSource[][] = []
  for (let i = 0; i < sources.length; i += size)
    chunks.push(sources.slice(i, i + size) as InboxSource[])

  return chunks.map((chunk) =>
    buildInboxQuery({ ...queryOptions, sources: chunk }),
  )
}

type InboxRateLimit = {
  cost: number
  nodeCount: number
  remaining: number
  resetAt: string
}

/**
 * Reassemble what `buildInboxQueries` split.
 *
 * The source aliases are disjoint, so they merge by assignment. `rateLimit` and
 * `viewer` are not: every part carries its own.
 *
 * `cost` and `nodeCount` SUM, because each part really was charged separately
 * and a host reporting one part's cost as the inbox's would understate it by
 * four. `remaining` takes the LOWEST reading — the parts run concurrently and
 * the budget only falls, so the smallest is the closest to now. `resetAt` rides
 * along with it, since a window and its expiry have to describe the same
 * moment.
 */
export const mergeInboxData = (parts: any[]): any => {
  const answered = parts.filter(Boolean)
  if (answered.length === 0) return undefined

  const limits: InboxRateLimit[] = answered
    .map((part) => part.rateLimit)
    .filter(Boolean)

  const scarcest = limits.reduce<InboxRateLimit | undefined>(
    (lowest, limit) =>
      !lowest || limit.remaining < lowest.remaining ? limit : lowest,
    undefined,
  )

  return {
    ...Object.assign({}, ...answered),
    viewer: answered.find((part) => part.viewer)?.viewer,
    ...(scarcest
      ? {
          rateLimit: {
            ...scarcest,
            cost: limits.reduce((total, l) => total + (l.cost ?? 0), 0),
            nodeCount: limits.reduce(
              (total, l) => total + (l.nodeCount ?? 0),
              0,
            ),
          },
        }
      : {}),
  }
}

/** What a source matched, against what it was allowed to return. */
export type SourceCoverage = {
  /** Everything the search matched, from GitHub's own `issueCount`. */
  total: number
  /** What actually came back — at most this source's cap. */
  shown: number
  /** `total > shown`: the rows are a sample of the set, not the set. */
  truncated: boolean
}

/**
 * What each source could see, against what it was allowed to show.
 *
 * The reason this exists is not the display gap, it is what a truncated source
 * does to a DIFF. A surface that marks arrivals and departures by comparing one
 * fetch with the next is asking "what changed in the world?" and reading the
 * answer off a fixed-size window. Where the window is smaller than the world,
 * those are different questions: any update to any of the 95 issues behind a
 * 30-row window reorders it, evicts something, and the eviction is reported as
 * news about the row that left — which never moved at all.
 *
 * So a consumer should treat presence changes on a truncated source as carrying
 * no information, and say what it is not showing instead. Both halves need this
 * number, and until 2026-09-07 it was fetched for exactly one source out of
 * eight and read by nobody — the guarantee lived in a comment and not in the
 * code.
 *
 * A source that answered with no `issueCount` reports `total: shown`, which
 * reads as "not truncated". That is the deliberate direction to fail in: a
 * missing count must never invent a truncation and silence real news.
 */
export const sourceCoverage = (
  data: any,
): Partial<Record<InboxSource, SourceCoverage>> => {
  const out: Partial<Record<InboxSource, SourceCoverage>> = {}
  if (!data) return out

  for (const source of INBOX_SOURCES) {
    const answered = data[source]
    if (!answered) continue
    const shown = answered.nodes?.length ?? 0
    const total =
      typeof answered.issueCount === "number" ? answered.issueCount : shown
    out[source] = { total, shown, truncated: total > shown }
  }

  return out
}

/** The sources whose rows are a sample rather than the set. */
export const truncatedSources = (data: any): InboxSource[] =>
  INBOX_SOURCES.filter((source) => sourceCoverage(data)[source]?.truncated)
