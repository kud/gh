import { execa } from "execa"
import type { PrHealthData } from "./health.js"

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
    // The last four are for the detail view's summary line rather than for
    // health. They ride along because this call is already per-PR and on demand:
    // adding field names to a `gh pr view` costs nothing measurable, where a
    // second call would cost a round trip on every drill-in.
    "statusCheckRollup,reviews,reviewDecision,mergeable,mergeStateStatus,author,additions,deletions,changedFiles,baseRefName",
  ])
  return JSON.parse(stdout) as PrHealthData
}
