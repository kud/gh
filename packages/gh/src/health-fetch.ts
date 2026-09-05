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
    "statusCheckRollup,reviews,reviewDecision,mergeable,mergeStateStatus,author",
  ])
  return JSON.parse(stdout) as PrHealthData
}
