import { parsePatterns, type RepoFilter } from "@kud/gh-ink"

export type CockpitArgs = {
  /** Scope every search to the repo you are standing in. */
  here: boolean
  /** Named filter from config, given positionally: `gh-cockpit work`. */
  named?: string
  /** Patterns from the flags, which override a named or default filter. */
  filter: RepoFilter
}

// `--include` / `--exclude` take comma-separated patterns and also accept
// `--include=a,b`. A named filter is positional, so `gh-cockpit work` reads the
// way the reader thinks — the flags are for the ad-hoc case, the name for the
// one they use daily.
//
// Flags OVERRIDE a named filter rather than merging with it: merging two filters
// that were each written as a complete answer produces a third nobody asked for,
// and the reader cannot see which one is in effect.
export const parseArgs = (argv: readonly string[]): CockpitArgs => {
  const include: string[] = []
  const exclude: string[] = []
  let here = false
  let named: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--here") {
      here = true
      continue
    }
    const eq = arg.match(/^--(include|exclude)=(.*)$/)
    if (eq) {
      ;(eq[1] === "include" ? include : exclude).push(...parsePatterns(eq[2]))
      continue
    }
    if (arg === "--include" || arg === "--exclude") {
      // Only consume the next argument if it could actually BE a value.
      // `--include --here` is a typo, and swallowing the flag as a pattern lost
      // the flag and produced a filter matching nothing — a blank cockpit with
      // no error, which reads as "nothing open" rather than "you mistyped".
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) continue
      i++
      ;(arg === "--include" ? include : exclude).push(...parsePatterns(next))
      continue
    }
    if (!arg.startsWith("-") && !named) named = arg
  }

  return {
    here,
    named,
    filter: { include, exclude },
  }
}

/** Whether the flags said anything at all, which decides if they override. */
export const hasPatterns = (f: RepoFilter): boolean =>
  (f.include?.length ?? 0) > 0 || (f.exclude?.length ?? 0) > 0
