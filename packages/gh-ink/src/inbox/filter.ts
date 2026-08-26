// Repo filtering by pattern, replacing the built-in two-way split.
//
// The inbox used to divide repos into "work" and "home" — a boolean on the row,
// a dedicated prop, a `w` key, and a filter function that took the literal
// string "work" or "home". None of that was a concept. It was two hard-coded
// filter presets wearing a keyboard shortcut, and it could not express a third
// slice, an org you contribute to occasionally, or the common case of having
// exactly one life.
//
// Patterns say the same thing as data. The old split was, in full:
//
//   work   include: ["acme/*", "me/acme-*"]
//   home   exclude: ["acme/*", "me/acme-*"]
//
// which is the whole of what the boolean ever meant — and now a reader can name
// a third, or none.

export type RepoFilter = {
  /** Show only repos matching one of these. Empty or absent means show all. */
  include?: readonly string[]
  /** Hide repos matching one of these. Applied after include, and wins. */
  exclude?: readonly string[]
}

// `*` stands for a run of characters within one segment, never across the `/`.
// That is what lets `acme/*` mean "this owner's repos" while `me/acme-*` picks
// out forks by name prefix — one metacharacter covering both, with no way to
// write a pattern that accidentally spans owners.
const toRegExp = (pattern: string): RegExp => {
  // A bare owner is sugar for all of its repos, so `--include acme` does the
  // obvious thing rather than matching a repo literally called "acme".
  const full = pattern.includes("/") ? pattern : `${pattern}/*`
  const escaped = full.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replace(/\*/g, "[^/]*")}$`, "i")
}

const matchesAny = (repo: string, patterns: readonly string[]): boolean =>
  patterns.some((p) => toRegExp(p).test(repo))

/**
 * Whether a repo survives the filter. No include list means everything is in;
 * exclude is applied afterwards and always wins, so a reader can take a whole
 * org and drop one repo from it without listing the rest.
 */
export const matchesFilter = (repo: string, filter: RepoFilter): boolean => {
  const { include = [], exclude = [] } = filter
  if (include.length > 0 && !matchesAny(repo, include)) return false
  return !matchesAny(repo, exclude)
}

/**
 * Parse a comma-separated pattern list, as a flag supplies it. Blank entries and
 * surrounding whitespace are dropped, so a trailing comma or a quoted list with
 * spaces after the commas both behave.
 */
export const parsePatterns = (value: string): string[] =>
  value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
