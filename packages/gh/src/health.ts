import { execa } from "execa"

// A PR's aggregate health as a single semantic token. Colour/glyph mapping is a
// UI concern and lives in the consuming surface (e.g. @kud/gh-ink) — the core
// only decides which token applies.
export type Health =
  | "ci-fail"
  | "conflict"
  | "changes-req"
  | "threads"
  | "pending"
  | "approved"
  | "waiting"
  | "draft"
  | "merged"
  | "closed"
  | "none"

// A single status check. Unifies GraphQL `statusCheckRollup.contexts.nodes`
// (CheckRun: name/status/conclusion/databaseId; StatusContext: context/state)
// and the flat `gh pr view --json statusCheckRollup` array — a caller normalises
// its raw shape into this, so the derivation never depends on the transport.
export type PrCheck = {
  name?: string
  context?: string
  status?: string
  conclusion?: string | null
  state?: string
  detailsUrl?: string
  targetUrl?: string
  workflowName?: string
  databaseId?: number
}

export type PrReview = { author: { login: string } | null; state: string }

// The detail-panel payload from `gh pr view --json …` — the individual checks,
// reviews and merge state a health panel renders.
export type PrHealthData = {
  statusCheckRollup: PrCheck[]
  reviews: PrReview[]
  reviewDecision: string | null
  mergeable: string
  mergeStateStatus: string
  author: { login: string } | null
}

// The canonical check classifiers — one source of truth, unifying the two
// hand-maintained copies that had drifted (glance vs panel). Four readings, and
// together they partition GitHub's CheckConclusionState rather than sampling it:
// a check FAILED when it reached a bad verdict, is PENDING while it is still
// running, is INCONCLUSIVE when it reached no verdict at all, and PASSED on an
// explicit success signal.
//
// The fail/inconclusive line is the one that matters, and it is about whether a
// judgement was ever reached — not about whether the check is green. FAILURE,
// TIMED_OUT and STARTUP_FAILURE are verdicts: the code, the run or the workflow
// file was examined and found wanting. CANCELLED and STALE are the absence of a
// verdict: the run was killed or abandoned, and nothing was learnt about the
// code either way.
//
// CANCELLED sat under fail until 2026-08-28, which is a claim the token cannot
// support. gnachman/iTerm2#731 banded under "Your move" with a red ✗ against a
// PR whose only sin was that its xcode-tests job waited six hours for a macOS
// runner on somebody else's infrastructure and was killed by Actions. A verdict
// was never reached, so there was nothing there for the author to fix — and a
// band that says otherwise is exactly the over-claiming the whose-move split
// exists to prevent.
//
// A cancelled run is still worth retriggering, so `isInconclusiveCheck` is not
// merely "not a failure": the health panel's `r` action finds its target through
// these predicates, and dropping CANCELLED from the fail set without a second
// home for it would have silently removed the one affordance that fixes this.
//
// STARTUP_FAILURE was in no set at all, which is the same bug pointing the other
// way: a workflow file too broken to start read as neither failing nor pending
// nor passing, so it rendered quiet. It is a verdict on the code and belongs
// with the failures.
export const isFailCheck = (c: PrCheck): boolean =>
  ["FAILURE", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED"].includes(
    c.conclusion ?? "",
  ) ||
  c.state === "FAILURE" ||
  c.state === "ERROR"

export const isPendingCheck = (c: PrCheck): boolean =>
  c.status === "IN_PROGRESS" || c.state === "PENDING"

// A terminal check that reached no verdict. Deliberately conclusion-only: there
// is no StatusContext state that means this, and inventing one would guess.
export const isInconclusiveCheck = (c: PrCheck): boolean =>
  ["CANCELLED", "STALE"].includes(c.conclusion ?? "")

export const isPassCheck = (c: PrCheck): boolean =>
  !isFailCheck(c) &&
  !isPendingCheck(c) &&
  !isInconclusiveCheck(c) &&
  (["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.conclusion ?? "") ||
    c.state === "SUCCESS")

// Collapse a rollup to the latest run per check name and drop SKIPPED ones: a
// re-run pushes a fresh CheckRun with a higher databaseId, so an older failure
// must not outvote the current pass. StatusContexts (no databaseId) keep their
// first occurrence.
export const latestChecks = (checks: PrCheck[]): PrCheck[] => {
  const latestByKey = new Map<string, PrCheck>()
  for (const c of checks) {
    const key = c.name ?? c.context ?? ""
    const existing = latestByKey.get(key)
    if (
      !existing ||
      (c.databaseId != null &&
        (existing.databaseId == null || c.databaseId > existing.databaseId))
    )
      latestByKey.set(key, c)
  }
  return [...latestByKey.values()].filter((c) => c.conclusion !== "SKIPPED")
}

export type ComputeHealthInput = {
  // Absent `isDraft` marks a non-PR (e.g. an issue) → "none".
  state?: string
  isDraft?: boolean
  checks: PrCheck[]
  mergeable?: string
  reviewDecision?: string | null
  unresolvedThreads?: number
}

// Derive the single health token. Precedence is deliberate: terminal states
// first, then the urgent actionable states, then unresolved threads (which
// outrank the passive pending/approved/waiting — an otherwise-quiet PR with open
// threads still needs your reply), then the passive states.
//
// An INCONCLUSIVE check gets no token of its own, and that is a decision rather
// than an omission. A health token earns its keep by changing whose move it is,
// and a "stale" one would band identically to `waiting` from all three standings
// — a token that flips no outcome is a label, and labels belong in the panel
// beside the check that earned them. So a PR whose only unfinished check was
// cancelled falls through to `waiting`, which is what it is: nothing is running,
// nothing is red, and nobody has reviewed it. The cancelled run is still named
// in the check list and still retriggerable from the health panel.
export const computeHealth = (input: ComputeHealthInput): Health => {
  if (input.state === "MERGED") return "merged"
  if (input.state === "CLOSED") return "closed"
  if (input.isDraft === undefined) return "none"
  if (input.isDraft) return "draft"

  const active = latestChecks(input.checks)
  const hasFail = active.some(isFailCheck)
  const hasPending = active.some(isPendingCheck)
  const unresolvedThreads = input.unresolvedThreads ?? 0

  if (hasFail) return "ci-fail"
  if (input.mergeable === "CONFLICTING") return "conflict"
  if (input.reviewDecision === "CHANGES_REQUESTED") return "changes-req"
  if (unresolvedThreads > 0) return "threads"
  if (hasPending) return "pending"
  if (input.reviewDecision === "APPROVED") return "approved"
  return "waiting"
}

// Fetch the detail-panel payload for one PR via the gh CLI. Uses `gh pr view`
// (not `gh api`) for the ready-shaped `--json` projection a panel renders.
export const fetchHealth = async (
  repo: string,
  number: number,
): Promise<PrHealthData> => {
  const { stdout } = await execa("gh", [
    "pr",
    "view",
    String(number),
    "--repo",
    repo,
    "--json",
    "statusCheckRollup,reviews,reviewDecision,mergeable,mergeStateStatus,author",
  ])
  return JSON.parse(stdout) as PrHealthData
}
