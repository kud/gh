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
 * `rateLimit { cost }`: the full query costs **73 points** of a 5000/hour
 * budget, at a nodeCount of ~16,870 — because `statusCheckRollup.contexts`
 * appears in five PR fragments and `reviewThreads(first: 50)` multiplies
 * beneath each one. A caller that renders a title and a link was paying for
 * every check run on every open PR.
 */
/**
 * How many of your own open PRs to ask for.
 *
 * This is the single biggest lever on the query's cost, because connections
 * MULTIPLY: the health and conversation fragments hang ~80 nodes off each PR
 * (`reviewThreads(first: 50)`, `statusCheckRollup.contexts(first: 20)`,
 * `labels(first: 10)`), so the outer number is a multiplier on all of them.
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
 * `comments(last: 1)` and ten labels. A PR drags roughly 80 nested nodes; an
 * issue drags about 12.
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
   * The 502 is a wall-clock refusal rather than a node-count one — cutting the
   * review-thread window by 65% still 502s at ~11s — so `first: 50` is the
   * ceiling with a foot over the line, and a full fragment cannot reach 99 at
   * any window. A two-tier fetch can: the full shape at the default cap for the
   * rows that get a verdict, then `{ shape: "minimal", limits: {
   * reviewRequests: 100 } }` for the rest.
   *
   * This note used to name the SEARCH as what was timing out, and that was
   * wrong in a way worth keeping visible: it made the fix look like "address
   * the rows directly and the problem goes away". It does not. A `nodes(ids:)`
   * lookup with the same selections dies at the same size and the same eleven
   * seconds — see `HEALTH_BATCH_SIZE`, where it is measured. What the request
   * came through was never the variable; how many nodes it had to expand was.
   *
   * A caller doing that owes the overflow rows an honest verdict. A minimal row
   * carries no health, and health absent is not health `waiting` — see
   * `computeHealth`'s note on why this set is all-or-nothing, and
   * `@kud/gh-workflow`'s `whoseMove`, which answers `unknown` rather than
   * guessing. `healthIdsFrom` / `buildHealthQueries` / `mergeHealth` are the
   * third tier that pays that debt where the caller wants the verdicts.
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
// `reviewThreads` is already `first: 50`, and eight more fields fifty times over
// is exactly the multiplication the budget note above exists to prevent.
const PR_CONVERSATION = `
      reactionGroups { content viewerHasReacted }
      comments(last: 1) { totalCount nodes { author { __typename login } createdAt reactionGroups { content viewerHasReacted } } }
      reviews(last: 1) { nodes { author { __typename login } state submittedAt } }
      reviewThreads(first: 50) { nodes {
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
      id number title createdAt url headRefName isDraft
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
      id number title createdAt url headRefName isDraft
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
      id number title createdAt url headRefName isDraft
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
        id number title createdAt url headRefName isDraft repository { nameWithOwner } author { login }
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
      id number title createdAt url headRefName isDraft
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
      id number title state isDraft createdAt mergedAt closedAt url
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
   * package handing out a 73-point query should hand out the means to see it.
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

/**
 * What a source matched, against what it was allowed to return.
 *
 * TWO FACTS AND AN ESTIMATE, and keeping them apart is the whole of this type.
 * `shown` and `cap` are ours — what we asked for and what came back. `total` is
 * GitHub's, and it has been caught wrong.
 */
export type SourceCoverage = {
  /**
   * What GitHub's `issueCount` said the search matched.
   *
   * AN ESTIMATE. It may be shown to a reader as an approximation and it may
   * never decide whether anything is reported — see the note on `capped`.
   */
  total: number
  /** How many rows actually came back. */
  shown: number
  /** The `first:` this source asked for on this fetch. */
  cap: number
  /**
   * We asked for N and got N, so the rows are a sample of the set.
   *
   * Derived from our own request rather than from `total`, which is the entire
   * point: a cap is a fact we hold, and it cannot be wrong about itself.
   */
  capped: boolean
  /**
   * Under its cap, and the count still claims more matched.
   *
   * Nothing was capped and rows are missing anyway, so this is an incomplete
   * ANSWER rather than a truncation, and it belongs with whatever vocabulary a
   * host uses for a source that failed. Reporting it as a cap names a mechanism
   * that was not operating, which is worse than saying nothing.
   *
   * It rests on `total` and therefore inherits its unreliability: read it as a
   * suspicion, never as a count of what is missing.
   */
  partial: boolean
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
 * So a consumer should treat presence changes on a capped source as carrying no
 * information, and say what it is not showing instead.
 *
 * `issueCount` USED TO DECIDE THAT, AND IT CANNOT. Until 2026-09-09 this
 * returned `truncated: total > shown`, which reads as a cap and is not one:
 * `issueCount` is an index aggregate computed on a different path from the node
 * materialisation, and the two are not a consistent snapshot. Measured that day
 * against a live account, one sweep, immediately after an eight-source document
 * had returned HTTP 502:
 *
 *   myPRs         issueCount   8   nodes 16   cap  30
 *   reviewed      issueCount  13   nodes 10   cap  20
 *   repoIssues    issueCount 111   nodes 83   cap 100
 *   repoPRs       issueCount   4   nodes  5   cap  30
 *   recentlyDone  issueCount  19   nodes 14   cap  30
 *
 * The first and fourth rows are the proof, and they are the reason this is a
 * rule rather than a hunch: THE COUNT CAME BACK SMALLER THAN THE SAMPLE DRAWN
 * FROM IT. A total that is exceeded by its own subset is not a total. Re-run
 * seconds later, every pair agreed, and 24 subsequent runs of the real query
 * agreed too — so the number is not merely stale, it is untrustworthy at
 * unpredictable moments, which is worse. What made it go wrong was never
 * established and does not need to be: the replacement does not consult it.
 *
 * What that cost downstream is a host reporting five capped sources of which
 * not one was near its cap, explaining each with a sentence about caps. A true
 * sentence about a false situation is the hardest kind of wrong to read, and
 * the reader correctly could not parse it.
 *
 * A source that answered with no `issueCount` reports `total: shown`, which
 * reads as neither capped nor partial unless the cap says otherwise. That is
 * the deliberate direction to fail in: a missing count must never invent a
 * truncation and silence real news.
 *
 * `limits` must be the ones the fetch ACTUALLY asked for, not the defaults, or
 * the cap this compares against is a different number from the one GitHub
 * honoured — a two-tier host raising `reviewRequests` to 100 and then measuring
 * against 20 would call every fetch capped forever.
 */
export const sourceCoverage = (
  data: any,
  limits: Partial<Record<InboxSource, number>> = {},
): Partial<Record<InboxSource, SourceCoverage>> => {
  const out: Partial<Record<InboxSource, SourceCoverage>> = {}
  if (!data) return out

  const caps = limitsFor({ limits })

  for (const source of INBOX_SOURCES) {
    const answered = data[source]
    if (!answered) continue
    const shown = answered.nodes?.length ?? 0
    const total =
      typeof answered.issueCount === "number" ? answered.issueCount : shown
    const cap = caps[source]
    out[source] = {
      total,
      shown,
      cap,
      capped: shown >= cap,
      partial: shown < cap && total > shown,
    }
  }

  return out
}

/**
 * The sources whose rows are a sample rather than the set.
 *
 * This is what a two-tier host asks before spending a second round trip, so it
 * has to be the CAP question and not the count one — an overflow fetch fired on
 * a bad `issueCount` buys nothing and costs a request.
 *
 * Coverage is computed once rather than per source. It was once rebuilt inside
 * the filter, which walked all eight sources eight times to answer about eight.
 */
export const cappedSources = (
  data: any,
  limits: Partial<Record<InboxSource, number>> = {},
): InboxSource[] => {
  const coverage = sourceCoverage(data, limits)
  return INBOX_SOURCES.filter((source) => coverage[source]?.capped)
}

/**
 * How many PR ids one health request may carry.
 *
 * The third tier's whole reason for existing, so it is a measurement rather than
 * a taste. Measured 2026-09-09 on a live account with 102 matching review
 * requests, asking for the real `PR_HEALTH` + `PR_CONVERSATION` selections by
 * node id:
 *
 *   nodes(ids:)  100    —        ~11s   502, twice
 *   nodes(ids:)   50   28 pts     8.7s  200   (6,200 nodes)
 *   nodes(ids:)   25   14 pts     4.0s  200   (3,100 nodes)
 *   4 × 25 in parallel   56 pts   6.0s wall   200 ×4
 *
 * WHICH CORRECTS THE NOTE ON `limits` ABOVE, and the correction is the useful
 * half: the 502 at `first: 100` was read there as the SEARCH timing out at
 * GitHub's proxy. It is not. A direct node lookup — no search index involved at
 * all — fails identically, at the same size and the same eleven seconds. What
 * dies is the resolver's wall clock expanding ~12,000 nodes of check rollups and
 * review threads, whichever door the request came through. The search endpoint
 * was innocent.
 *
 * So batching is the MECHANISM here, not an optimisation of it: a tier three
 * that fired one 100-id request would reproduce the exact failure it exists to
 * fix. Cost per PR is 0.56 points either way — GraphQL prices nodes, not
 * requests — so splitting buys reliability at no extra budget, exactly as
 * `INBOX_SOURCES_PER_QUERY` does one level up.
 */
export const HEALTH_BATCH_SIZE = 25

/*
 * A node the health fragment was never asked for.
 *
 * Tested on `reviewDecision` alone, and that is sound rather than sloppy: the
 * selection is dropped WHOLE (see `PR_HEALTH`), so one key's absence is the
 * whole set's absence. `@kud/gh-workflow`'s `hasHealthSelection` tests all three
 * with `||` for a different job — it guards against a caller who built the node
 * by hand — and importing it here is not available anyway, since the flow runs
 * this way and not back.
 */
const lacksHealth = (node: any): boolean =>
  Boolean(node) && !("reviewDecision" in node)

/*
 * Rows whose verdict is already settled without the selection, and which
 * therefore buy nothing by being enriched: `computeHealth` short-circuits on
 * `state` and `isDraft` before it reads a single check.
 *
 * A COST filter, not a correctness one — merging health onto a merged PR changes
 * no answer, it just spends 0.56 points to learn something already known.
 */
const settledWithoutHealth = (node: any): boolean =>
  node?.state === "MERGED" || node?.state === "CLOSED" || node?.isDraft === true

/**
 * PR node ids on this data that arrived WITHOUT the health selection.
 *
 * The filter is load-bearing rather than tidiness. A two-tier fetch merges the
 * cheap overflow after the full rows precisely so a URL collision keeps the
 * full one, which means a naive "every id here" would re-fetch the rows that
 * already carry a verdict — on a 102-row account that is ~11 points bought to
 * learn what tier one already answered.
 *
 * `sources` narrows it further, and a caller should use it: only the PR sources
 * can be enriched at all, and the issue sources that truncate carry no health to
 * begin with.
 */
export const healthIdsFrom = (
  data: any,
  sources?: readonly InboxSource[],
): string[] => {
  const ids: string[] = []
  if (!data) return ids

  for (const source of sources ?? INBOX_SOURCES)
    for (const node of data[source]?.nodes ?? []) {
      if (node?.__typename !== "PullRequest") continue
      if (typeof node.id !== "string") continue
      if (!lacksHealth(node) || settledWithoutHealth(node)) continue
      ids.push(node.id)
    }

  return [...new Set(ids)]
}

/**
 * One `nodes(ids:)` document carrying the health and conversation selections for
 * PRs already identified elsewhere.
 *
 * BOTH fragments, and health alone would be a bug. `computeHealth`'s precedence
 * reads `unresolvedThreads` out of `reviewThreads`, which lives in
 * `PR_CONVERSATION` — so a health-only enrichment would report `waiting` on a PR
 * with open threads, which is the silent wrong token this whole set is
 * all-or-nothing to prevent, one layer down.
 *
 * It also costs almost nothing to include: `reviewThreads` is ~100 of the ~124
 * nodes a PR drags, so the rest of the conversation rides along nearly free —
 * and an enriched overflow row comes out FULLY equal to a tier-one row, with its
 * last actor and activity age intact, rather than a second-class one carrying a
 * token and no story behind it.
 */
export const buildHealthQuery = (ids: readonly string[]) => `
{
  rateLimit { cost nodeCount remaining resetAt }
  nodes(ids: [${ids.map((id) => JSON.stringify(id)).join(", ")}]) {
    __typename
    ... on PullRequest {
      id
      ${PR_HEALTH}
      ${PR_CONVERSATION}
    }
  }
}
`

/**
 * The same, split into documents small enough to answer — to be issued in
 * parallel and handed to `mergeHealth`.
 *
 * Prefer this to `buildHealthQuery` for anything but a handful of ids. See
 * `HEALTH_BATCH_SIZE` for why the split is the mechanism.
 */
export const buildHealthQueries = (
  ids: readonly string[],
  batchSize: number = HEALTH_BATCH_SIZE,
): string[] => {
  const size = Math.max(1, Math.trunc(batchSize))
  const queries: string[] = []
  for (let i = 0; i < ids.length; i += size)
    queries.push(buildHealthQuery(ids.slice(i, i + size)))
  return queries
}

/*
 * Every health key, and the rollup non-null.
 *
 * GraphQL can answer 200 with `errors` and null fields, and a node arriving with
 * `reviewDecision` present but `statusCheckRollup: null` is the one shape that
 * defeats the guard downstream: `hasHealthSelection` would read true on the
 * first key while `computeHealth` saw zero checks and returned `waiting`. A
 * confident wrong answer, through the only door left open.
 *
 * So the test is per NODE rather than per response. A partial answer should
 * degrade to fewer verdicts, never to a wrong one.
 */
const carriesHealth = (node: any): boolean =>
  Boolean(node) &&
  "reviewDecision" in node &&
  "mergeable" in node &&
  node.statusCheckRollup != null

/**
 * Merge tier-three health onto the rows that were fetched without it.
 *
 * By node id, and all-or-nothing per node — a batch that failed merges nothing,
 * a node that merges nothing keeps no health keys, `healthOf` reads the absence
 * and `whoseMove` answers `unknown`. The invariant holds by CONSTRUCTION rather
 * than by a flag anyone has to remember to pass, which is the same reason
 * `@kud/gh-workflow` tests presence instead of trusting its caller.
 *
 * Returns a new object; the input is not mutated, because a caller merging the
 * enriched copy alongside the original relies on the original still being what
 * it was.
 */
export const mergeHealth = (data: any, parts: readonly any[]): any => {
  if (!data) return data

  const byId = new Map<string, any>()
  for (const part of parts)
    for (const node of part?.nodes ?? [])
      if (typeof node?.id === "string" && carriesHealth(node))
        byId.set(node.id, node)

  if (byId.size === 0) return data

  const out: any = { ...data }
  for (const source of INBOX_SOURCES) {
    const answered = data[source]
    if (!answered?.nodes) continue
    out[source] = {
      ...answered,
      nodes: answered.nodes.map((node: any) => {
        const found =
          typeof node?.id === "string" ? byId.get(node.id) : undefined
        return found ? { ...node, ...found } : node
      }),
    }
  }

  return out
}
