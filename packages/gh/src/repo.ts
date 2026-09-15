import { execa } from "execa"

// Repository metadata — facts about the repo rather than about anything in it.
//
// Separate from `health-fetch.ts` on purpose, and the comment above the
// projection there is the reason. That one boasts that `additions`,
// `deletions`, `changedFiles` and `baseRefName` ride along on a call already in
// flight rather than costing a round trip, which is true and is exactly the
// argument a later reader will try to extend to the default branch. It does not
// extend, for two reasons:
//
//   • `gh pr view --json` HAS NO DEFAULT-BRANCH FIELD. Checked against the live
//     field list on gh 2.100.0: the projection carries `baseRefName`,
//     `headRefName`, `headRepository`, `headRepositoryOwner` and
//     `isCrossRepository`, and nothing naming the repo's own default. Tidying
//     this call into that projection does not make it cheaper, it makes it
//     return nothing.
//   • It is a PER-REPO fact, so it caches on a different key from anything
//     per-PR. Folding it into a per-PR call would re-fetch an unchanging fact
//     once per pull request.
//
// No memo here. This package is request-in / data-out with no module state, and
// the caller that wants one has a session to hang it on — cockpit keys it by
// repo through `useCachedResource`, which paints the last known answer from disk
// immediately and revalidates behind it. So the cost is one concurrent call per
// drill-in, not one per repo per session; what the cache buys is that nobody
// ever waits for it, and that a repo renaming its default branch heals itself.
// A `Map` at module scope would be the first mutable state in the package and
// would leak between tests in the same file.
/**
 * The repo's default branch. `undefined` when the repo genuinely has none.
 *
 * THROWS RATHER THAN SWALLOWING, and the two outcomes have to stay apart. A
 * consumer suppressing something on a match reads `undefined` as *draw it
 * anyway* — so a failed call resolving to `undefined` would be read as "this
 * repo has no default branch" and redraw a cell that had been correctly
 * suppressed. Against a caller that revalidates on every mount, that is a
 * single network blip flickering the cell back on.
 *
 * Throwing instead lets a caching caller keep the stale-but-good value it
 * already has. The split is: ANSWERED, NO DEFAULT → `undefined`; DID NOT ANSWER
 * → throw, keep what you had.
 */
export const fetchDefaultBranch = async (
  repo: string,
): Promise<string | undefined> => {
  const { stdout } = await execa("gh", [
    "repo",
    "view",
    repo,
    "--json",
    "defaultBranchRef",
  ])
  return (
    (JSON.parse(stdout) as { defaultBranchRef?: { name?: string } | null })
      .defaultBranchRef?.name ?? undefined
  )
}
