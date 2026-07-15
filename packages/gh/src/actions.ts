import { execa } from "execa"

// PR write-actions — the mutating gh operations a health panel offers. Kept in
// the core (not the UI) so any surface can invoke them; they shell out to `gh`
// and resolve when the command completes.

// Merge a pull request with a merge commit.
export const mergePr = async (repo: string, number: number): Promise<void> => {
  await execa("gh", ["pr", "merge", String(number), "--repo", repo, "--merge"])
}

// Re-run only the failed jobs of a GitHub Actions run.
export const rerunFailedRun = async (
  repo: string,
  runId: string,
): Promise<void> => {
  await execa("gh", ["run", "rerun", runId, "--repo", repo, "--failed"])
}

// Re-request a review by adding the reviewer back onto the PR.
export const reRequestReviewer = async (
  repo: string,
  number: number,
  login: string,
): Promise<void> => {
  await execa("gh", [
    "pr",
    "edit",
    String(number),
    "--repo",
    repo,
    "--add-reviewer",
    login,
  ])
}
