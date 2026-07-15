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
// hand-maintained copies that had drifted (glance vs panel). A check is failing
// on any terminal-bad conclusion or a bad StatusContext state; pending while it
// is still running; passing otherwise (an explicit success signal).
export const isFailCheck = (c: PrCheck): boolean =>
  ["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(
    c.conclusion ?? "",
  ) ||
  c.state === "FAILURE" ||
  c.state === "ERROR"

export const isPendingCheck = (c: PrCheck): boolean =>
  c.status === "IN_PROGRESS" || c.state === "PENDING"

export const isPassCheck = (c: PrCheck): boolean =>
  !isFailCheck(c) &&
  !isPendingCheck(c) &&
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
