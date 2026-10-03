// The pulse — "has anything on my plate moved since I last looked?"
//
// A full inbox read is tens of points of a 5000/hour budget (see `buildInboxQuery`),
// so a surface that wants to feel live cannot simply read it every minute. The
// pulse is the cheap question asked in between: one document, a handful of
// scalars, measured live on 2026-09-27 at **1 point** with `rateLimit { cost }`.
// A surface compares one pulse's fingerprint with the last and pays for a full
// read only when they differ.
//
// It is a CURSOR, not a mirror. Nothing here describes the inbox's contents —
// a fingerprint is only ever compared for equality with another fingerprint, so
// a surface must never try to render from it or reconstruct rows out of it.

import { MY_PRS_LIMIT, inboxScope } from "./inbox.js"

export type PulseQueryOptions = {
  /** `owner/name`. Watches one repository, exactly as a scoped inbox reads it. */
  repo?: string
  /** `owner/name` repositories the pulse must not watch, as the inbox hides them. */
  excludeRepos?: readonly string[]
}

/**
 * Build the pulse query.
 *
 * Three `first: 1, sort:updated-desc` searches answer "what is the newest
 * change?" over the same ground the inbox reads — anything involving me, the
 * repos I own, and review requests — by way of `inboxScope`, so the pulse cannot
 * watch a different set of repos from the one the board shows.
 *
 * `involves:@me` and the owned-repos search carry no `is:open`, on purpose: a
 * close or a merge is a change the board has to reflect, and an `is:open` search
 * cannot see the row that just left it.
 *
 * The fourth alias exists because `updatedAt` does NOT move for everything the
 * board cares about. Measured on kud/glyphs#15: the check suite finished at
 * 21:13:02Z and the PR's `updatedAt` stayed at 21:12:41Z. A pulse keyed on
 * timestamps alone would have sat on a green PR the board still showed as
 * pending, for as long as nothing else happened. So my own open PRs carry the
 * two states that change without touching `updatedAt` — `mergeable` and the
 * last commit's rollup — at the same cap the inbox uses for them, so every PR
 * the board can show is one the pulse is watching.
 *
 * `rateLimit` rides along for the same reason it does on the inbox: it is the
 * only honest measure of cost, and `remaining` is what lets a surface slow its
 * pulse down before the budget runs dry rather than after.
 */
export const buildPulseQuery = (options: PulseQueryOptions = {}) => {
  const { scope, owned } = inboxScope(options.repo, options.excludeRepos)
  const latest = (alias: string, qualifiers: string) =>
    `  ${alias}: search(query: "${scope}${qualifiers} sort:updated-desc", type: ISSUE, first: 1) {
    nodes { ... on Issue { updatedAt } ... on PullRequest { updatedAt } }
  }`

  return `
{
  rateLimit { cost remaining }
${latest("involved", "involves:@me")}
${latest("owned", `${owned}archived:false`.trim())}
${latest("reviewRequests", "is:pr is:open review-requested:@me")}
  myPRs: search(query: "${scope}is:pr is:open author:@me", type: ISSUE, first: ${MY_PRS_LIMIT}) {
    nodes { ... on PullRequest {
      number mergeable
      repository { nameWithOwner }
      commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
    }}
  }
}
`
}

const TIMESTAMP_ALIASES = ["involved", "owned", "reviewRequests"] as const

/**
 * Collapse a pulse response to one string that changes when the board would.
 *
 * Two parts: the newest `updatedAt` across the three timestamp searches, and
 * one `repo#number:mergeable:rollup` entry per authored PR. The entries are
 * SORTED before joining, because search order is not a contract — two identical
 * boards returned in a different order must fingerprint the same, or every
 * reshuffle would buy a full read for nothing.
 *
 * ISO-8601 timestamps from GitHub are all UTC with the same precision, so the
 * string maximum is the chronological maximum and no date parsing is needed.
 *
 * Missing pieces degrade to empty rather than throwing: a null search (GitHub
 * returns partial data on a timed-out alias) or a PR with no commits reads as
 * "nothing there", which at worst causes one spurious full read. Throwing would
 * turn a partial answer into no answer, and the pulse would go quiet.
 */
export const pulseFingerprint = (data: any): string => {
  const newest = TIMESTAMP_ALIASES.flatMap(
    (alias) => data?.[alias]?.nodes ?? [],
  )
    .map((node: any) => node?.updatedAt)
    .filter((stamp: unknown): stamp is string => typeof stamp === "string")
    .reduce((max, stamp) => (stamp > max ? stamp : max), "")

  const mine = (data?.myPRs?.nodes ?? [])
    .filter((node: any) => node && typeof node.number === "number")
    .map((node: any) => {
      const repo = node.repository?.nameWithOwner ?? ""
      const rollup =
        node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? ""
      return `${repo}#${node.number}:${node.mergeable ?? ""}:${rollup}`
    })
    .sort()

  return `${newest}|${mine.join(",")}`
}
