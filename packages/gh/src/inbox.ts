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
const SOURCES: Record<InboxSource, (s: Selections) => string> = {
  myPRs: ({ scope, health, conversation }) => `  myPRs: search(query: "${scope}is:pr is:open author:@me", type: ISSUE, first: ${MY_PRS_LIMIT}) {
    issueCount
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  reviewRequests: ({ scope, health, conversation }) => `  reviewRequests: search(query: "${scope}is:pr is:open review-requested:@me", type: ISSUE, first: 20) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  reviewed: ({ scope, health, conversation }) => `  reviewed: search(query: "${scope}is:pr is:open reviewed-by:@me -author:@me -review-requested:@me", type: ISSUE, first: 20) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  assigned: ({
    scope,
    health,
    conversation,
    issueConversation,
    issueLabels,
  }) => `  assigned: search(query: "${scope}is:open assignee:@me", type: ISSUE, first: 30) {
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

  repoIssues: ({
    scope,
    owned,
    issueConversation,
    issueLabels,
  }) => `  repoIssues: search(query: "${scope}${owned}is:issue is:open archived:false", type: ISSUE, first: 30) {
    nodes { __typename ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${issueConversation}
      ${issueLabels}
    }}
  }`,

  authoredIssues: ({
    scope,
    issueConversation,
    issueLabels,
  }) => `  authoredIssues: search(query: "${scope}is:issue is:open author:@me archived:false", type: ISSUE, first: 30) {
    nodes { ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${issueConversation}
      ${issueLabels}
    }}
  }`,

  repoPRs: ({
    scope,
    owned,
    health,
    conversation,
  }) => `  repoPRs: search(query: "${scope}${owned}is:pr is:open -author:@me archived:false", type: ISSUE, first: 30) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }`,

  recentlyDone: ({
    scope,
    doneSince,
  }) => `  recentlyDone: search(query: "${scope}is:pr author:@me -is:open closed:>=${doneSince}", type: ISSUE, first: 30) {
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
export const buildInboxQuery = (options: InboxQueryOptions = {}) => {
  const selections = selectionsFor(options)
  const sources = options.sources ?? INBOX_SOURCES

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
${sources.map((source) => SOURCES[source](selections)).join("\n")}
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
  const sources = options.sources ?? INBOX_SOURCES
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
            nodeCount: limits.reduce((total, l) => total + (l.nodeCount ?? 0), 0),
          },
        }
      : {}),
  }
}
