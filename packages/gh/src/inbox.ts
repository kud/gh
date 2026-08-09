// The inbox query — one GraphQL round-trip for "what is on my plate": my PRs,
// review requests, reviews I have given, assigned work, issues and PRs on my
// repos, and what I closed recently.
//
// Query-only by design. Assembling the result into sections is the surface's
// own vocabulary — cockpit splits home from work, a web dashboard may group by
// project — so nothing here decides what a section is.

/** A repo-scoped or account-wide inbox. */
export type InboxQueryOptions = {
  /** `owner/name`. Scopes every search to one repository. */
  repo?: string
  /** How far back `recentlyDone` looks. Defaults to 14 days. */
  doneWithinDays?: number
}

// computeHealth's precedence needs reviewDecision, mergeable and the check
// rollup. A fragment that omits them does NOT degrade gracefully — it falls
// straight through to whatever token is left, so a PR you already sent back
// renders as "awaiting review" and a failing one renders as quiet. Every PR
// fragment therefore carries the whole set; none of it is optional.
const PR_HEALTH = `
      isDraft reviewDecision mergeable
      statusCheckRollup { contexts(first: 20) { nodes {
        ... on CheckRun { name conclusion status }
        ... on StatusContext { context state }
      } } }`

// Whose turn it is cannot be read off a count, so every comment-bearing edge
// carries its latest author and timestamp: the conversation, the review bodies,
// and each thread's last reply. The last commit rides along so a consumer can
// say whether the author has pushed since being sent back.
const PR_CONVERSATION = `
      comments(last: 1) { totalCount nodes { author { login } createdAt } }
      reviews(last: 1) { nodes { author { login } state submittedAt } }
      reviewThreads(first: 50) { nodes {
        isResolved
        comments(last: 1) { totalCount nodes { author { login } createdAt } }
      } }
      commits(last: 1) { nodes { commit { committedDate } } }`

const ISSUE_CONVERSATION = `
      comments(last: 1) { totalCount nodes { author { login } createdAt } }`

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
}: InboxQueryOptions = {}) => {
  const scope = repo ? `repo:${repo} ` : ""
  const owned = repo ? "" : "user:@me "
  const doneSince = sinceDay(doneWithinDays)

  return `
{
  viewer { login }
  myPRs: search(query: "${scope}is:pr is:open author:@me", type: ISSUE, first: 100) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName
      repository { nameWithOwner }
      ${PR_HEALTH}
      ${PR_CONVERSATION}
    }}
  }
  reviewRequests: search(query: "${scope}is:pr is:open review-requested:@me", type: ISSUE, first: 20) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName
      repository { nameWithOwner }
      author { login }
      ${PR_HEALTH}
      ${PR_CONVERSATION}
    }}
  }
  reviewed: search(query: "${scope}is:pr is:open reviewed-by:@me -author:@me -review-requested:@me", type: ISSUE, first: 20) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName
      repository { nameWithOwner }
      author { login }
      ${PR_HEALTH}
      ${PR_CONVERSATION}
    }}
  }
  assigned: search(query: "${scope}is:open assignee:@me", type: ISSUE, first: 30) {
    nodes {
      __typename
      ... on Issue {
        number title createdAt url repository { nameWithOwner } author { login }
        ${ISSUE_CONVERSATION}
        ${ISSUE_LABELS}
      }
      ... on PullRequest {
        number title createdAt url headRefName repository { nameWithOwner } author { login }
        ${PR_HEALTH}
        ${PR_CONVERSATION}
      }
    }
  }
  repoIssues: search(query: "${scope}${owned}is:issue is:open archived:false", type: ISSUE, first: 30) {
    nodes { __typename ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${ISSUE_CONVERSATION}
      ${ISSUE_LABELS}
    }}
  }
  authoredIssues: search(query: "${scope}is:issue is:open author:@me archived:false", type: ISSUE, first: 30) {
    nodes { ... on Issue {
      number title createdAt url
      repository { nameWithOwner }
      author { login }
      ${ISSUE_CONVERSATION}
      ${ISSUE_LABELS}
    }}
  }
  repoPRs: search(query: "${scope}${owned}is:pr is:open -author:@me archived:false", type: ISSUE, first: 30) {
    nodes { __typename ... on PullRequest {
      number title createdAt url headRefName
      repository { nameWithOwner }
      author { login }
      ${PR_HEALTH}
      ${PR_CONVERSATION}
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
