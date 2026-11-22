// Shell lines the inbox hands to iTerm2 to type into a live session.
//
// Every one of them used to be assembled by bare interpolation, and the values
// interpolated are not ours: a PR's head branch is whatever its author named it,
// and git allows `;`, `$`, `|`, `{`, `}`, `"` and backticks in a ref — with
// `${IFS}` standing in for the spaces it forbids. A branch named by any
// contributor to a watched repo therefore ran commands on the owner's machine the
// moment they pressed "Switch here", opened the PR in a tab, or launched an agent
// on it. Two of those sites went further and spliced the branch into the
// AppleScript source itself, where a `"` closed the string.
//
// So nothing remote reaches a shell line except through `shellQuote`, the line
// reaches iTerm2 only through the ITERM_CMD environment variable (AppleScript
// reads it with `system attribute` and never parses it, so there is nothing to
// escape on that side), and the builders below are pure so the quoting can be
// pinned in a test without an iTerm2 in sight.

/**
 * POSIX single-quote a value so a shell reads it back as exactly one word,
 * whatever it contains. Inside single quotes nothing is special except the
 * closing quote itself, which is spelled `'\''`: close, escaped quote, reopen.
 */
export const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

/**
 * Whether `name` is a branch name git itself would accept — the rules of
 * `git check-ref-format --branch`, plus a refusal of a leading `-` so the name
 * can never be read as an option even where `--` is not honoured.
 *
 * This is the second line of defence, not the first: `;`, `$`, `|` and
 * backticks are all legal in a ref, so it cannot stand in for quoting. What it
 * buys is that a value which is not a branch at all — a GraphQL field gone
 * wrong, a control character, a newline that would end the typed line early —
 * never reaches the terminal, quoted or not.
 */
export const isSafeBranchName = (name: string): boolean => {
  if (name.length === 0 || name.length > 255) return false
  if (name.startsWith("-")) return false
  if (name === "@") return false
  // ASCII control characters, DEL, space, and the five git reserves for revision
  // syntax and globbing.
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(name)) return false
  if (name.includes("..") || name.includes("@{") || name.includes("//"))
    return false
  if (name.startsWith("/") || name.endsWith("/") || name.endsWith("."))
    return false
  return name
    .split("/")
    .every((part) => !part.startsWith(".") && !part.endsWith(".lock"))
}

/** `owner/name` as GitHub spells it — the only shape a repo slug takes. */
export const isSafeRepoSlug = (repoFull: string): boolean =>
  /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repoFull) &&
  !repoFull.endsWith("/.") &&
  !repoFull.endsWith("/..")

/** How `buildCheckoutCmd` found, or will make, the local checkout. */
export type CheckoutPlan =
  | { kind: "local"; path: string }
  | { kind: "clone"; cloneBase: string; repoFull: string; repoName: string }
  | {
      kind: "fork-clone"
      cloneBase: string
      login: string
      forkName: string
      repoFull: string
    }
  | { kind: "fork-new"; cloneBase: string; repoFull: string }

/**
 * The line that lands in a repo's checkout and, given a branch, fetches and
 * switches to it. Pure: every path, slug, login and branch is quoted, and refs
 * sit behind `--`. Throws on a branch that is not a branch, so a caller shows a
 * failure rather than typing something it cannot vouch for.
 */
export const checkoutCmdFor = (plan: CheckoutPlan, branch: string): string => {
  let cmd: string
  switch (plan.kind) {
    case "local":
      cmd = `cd ${shellQuote(plan.path)}`
      break
    case "clone":
      cmd = `cd ${shellQuote(plan.cloneBase)} && gh repo clone ${shellQuote(plan.repoFull)} && cd ${shellQuote(plan.repoName)}`
      break
    case "fork-clone":
      cmd =
        `cd ${shellQuote(plan.cloneBase)}` +
        ` && git clone ${shellQuote(`git@github.com:${plan.login}/${plan.forkName}.git`)}` +
        ` && cd ${shellQuote(plan.forkName)}` +
        ` && git remote add upstream ${shellQuote(`git@github.com:${plan.repoFull}.git`)}`
      break
    case "fork-new":
      // The `$(ls …)` is ours and must stay live: it finds the directory the
      // fork just cloned into, whose name `gh` chose.
      cmd = `cd ${shellQuote(plan.cloneBase)} && gh repo fork ${shellQuote(plan.repoFull)} --clone && cd "$(ls -td -- */ | head -1)"`
      break
  }
  if (branch) cmd += ` && ${fetchAndSwitchCmd(branch)}`
  return cmd
}

/** `git fetch` the branch from origin (quietly, best effort), then switch to it. */
export const fetchAndSwitchCmd = (branch: string): string => {
  const b = assertBranch(branch)
  return `git fetch origin -- ${b} 2>/dev/null; git switch -- ${b}`
}

/** Switch the current checkout to `branch` — the inbox's "Switch here". */
export const switchCmd = (branch: string): string =>
  `git switch -- ${assertBranch(branch)}`

const assertBranch = (branch: string): string => {
  if (!isSafeBranchName(branch))
    throw new Error(`refusing branch name ${JSON.stringify(branch)}`)
  return shellQuote(branch)
}
