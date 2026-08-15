// The inbox query — one GraphQL round-trip for "what is on my plate": my PRs,
// review requests, reviews I have given, assigned work, issues and PRs on my
// repos, and what I closed recently.
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
 * `rateLimit { cost }`: the full query costs **111 points** of a 5000/hour
 * budget, at a nodeCount of ~25,550 — because `statusCheckRollup.contexts`
 * appears in five PR fragments and `reviewThreads(first: 50)` multiplies
 * beneath each one. A caller that renders a title and a link was paying for
 * every check run on every open PR. At 111 a poller gets 45 refreshes an hour.
 */
export type InboxShape = "full" | "minimal"

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
const PR_CONVERSATION = `
      comments(last: 1) { totalCount nodes { author { __typename login } createdAt } }
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

/**
 * Build the inbox query. Without `repo`, it is account-wide.
 *
 * The two qualifiers do NOT compose. `user:@me` means "in repos I own", and
 * GitHub ANDs search qualifiers — so `user:@me repo:someone-else/x` matches
 * nothing, and a scoped inbox on a repo you contribute to but do not own would
 * render empty and read as "nothing to do here". So `repo:` REPLACES
 * `user:@me` rather than joining it.
 */
export const buildInboxQuery = ({
  repo,
  doneWithinDays = 14,
  shape = "full",
}: InboxQueryOptions = {}) => {
  const scope = repo ? `repo:${repo} ` : ""
  const owned = repo ? "" : "user:@me "
  const doneSince = sinceDay(doneWithinDays)

  /* Interpolated as empty strings rather than branching the query text, so the
     two shapes cannot drift into two separately-maintained queries. */
  const full = shape === "full"
  const health = full ? PR_HEALTH : ""
  const conversation = full ? PR_CONVERSATION : ""
  const issueConversation = full ? ISSUE_CONVERSATION : ""
  const issueLabels = full ? ISSUE_LABELS : ""

  return `
{
  viewer { login }
  myPRs: search(query: "${scope}is:pr is:open author:@me", type: ISSUE, first: 100) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }
  reviewRequests: search(query: "${scope}is:pr is:open review-requested:@me", type: ISSUE, first: 20) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }
  reviewed: search(query: "${scope}is:pr is:open reviewed-by:@me -author:@me -review-requested:@me", type: ISSUE, first: 20) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }
  assigned: search(query: "${scope}is:open assignee:@me", type: ISSUE, first: 30) {
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
  }
  repoIssues: search(query: "${scope}${owned}is:issue is:open archived:false", type: ISSUE, first: 30) {
    nodes { __typename ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${issueConversation}
      ${issueLabels}
    }}
  }
  authoredIssues: search(query: "${scope}is:issue is:open author:@me archived:false", type: ISSUE, first: 30) {
    nodes { ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${issueConversation}
      ${issueLabels}
    }}
  }
  repoPRs: search(query: "${scope}${owned}is:pr is:open -author:@me archived:false", type: ISSUE, first: 30) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName isDraft
      repository { nameWithOwner }
      author { login }
      ${health}
      ${conversation}
    }}
  }
  recentlyDone: search(query: "${scope}is:pr author:@me -is:open closed:>=${doneSince}", type: ISSUE, first: 30) {
    nodes { __typename ... on PullRequest {
      number title state isDraft createdAt mergedAt closedAt url
      repository { nameWithOwner }
    }}
  }
}
`
}
