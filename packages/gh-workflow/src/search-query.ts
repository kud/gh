import type { AnyItem } from "./core.js"

/**
 * A tiny GitHub-shaped query language for cockpit's `/` search: tokens split
 * on whitespace, double-quoted phrases kept whole, `key:value` qualifiers
 * (author, repo), a leading `-` negating either, everything ANDed.
 *
 * It exists because the single substring match answered "what" but not "who"
 * or "where": narrowing a list to dependabot's rows, or to everything outside
 * a legacy repo, is what qualifiers buy. The fallback rule — an unknown
 * `key:` buys a bare term of the whole token — is the escape hatch: a title
 * may hold a colon, and users type those every day into a box that used to be
 * a substring search.
 *
 * No `is:`: the tab already answers kind, and its groups answer draft,
 * approved and whose, so `is:x` is just text here.
 */
export type QueryTerm =
  | { kind: "text"; negate: boolean; value: string }
  | {
      kind: "qualifier"
      negate: boolean
      key: "author" | "repo"
      value: string
    }

const QUALIFIER_KEYS = new Set(["author", "repo"])

export const parseSearchQuery = (query: string): QueryTerm[] => {
  const terms: QueryTerm[] = []
  let token = ""
  // A `-` counts only as the token's very first unquoted character, which is
  // what keeps `octo-cat` a word and `-"phase one"` a negated phrase.
  let negate = false
  let started = false
  // `quoted` marks a token born in a quote pair, so flush treats its whole
  // content as text and never split on `:`; `inQuote` only positions the scan.
  let quoted = false
  let inQuote = false
  const flush = (): void => {
    if (!started) return
    if (!token) {
      // A quoted phrase that never filled (`""`, live typing) buys nothing,
      // same honesty as an empty qualifier value.
      token = ""
      negate = false
      quoted = false
      started = false
      return
    }
    if (quoted) {
      terms.push({ kind: "text", negate: negate, value: token })
    } else {
      const colon = token.indexOf(":")
      if (colon > 0) {
        const key = token.slice(0, colon).toLowerCase()
        const value = token.slice(colon + 1)
        if (QUALIFIER_KEYS.has(key)) {
          // A qualifier typed only halfway (live typing) drops out rather
          // than hiding every row behind an empty comparison.
          if (value)
            terms.push({
              kind: "qualifier",
              negate: negate,
              key: key as "author" | "repo",
              value: value,
            })
        } else if (token) {
          // Unknown key stays text, whole token, so a colon in a title still
          // searches, and a typo'd qualifier cannot silently mute the query.
          terms.push({ kind: "text", negate: negate, value: token })
        }
      } else {
        terms.push({ kind: "text", negate: negate, value: token })
      }
    }
    token = ""
    negate = false
    quoted = false
    started = false
  }
  for (const ch of query.trim()) {
    if (ch === '"') {
      if (inQuote) {
        inQuote = false
        flush()
      } else {
        started = true
        quoted = true
        inQuote = true
      }
      continue
    }
    if (!inQuote && (ch === " " || ch === "\t")) {
      flush()
      continue
    }
    if (!started && !quoted && ch === "-" && !negate) {
      negate = true
      started = true
      continue
    }
    started = true
    token += ch
  }
  // Unclosed quote: everything since the opening quote is one term anyway.
  flush()
  return terms
}

/**
 * GitHub spells the same bot login two ways — `name[bot]` or `app/name`,
 * depending on which source produced the row — so both sides of an author
 * comparison are normalised to a common shape before being matched.
 * Lowercased further, so case in logins is display, not identity.
 */
const normaliseLogin = (login: string): string =>
  login
    .toLowerCase()
    .replace(/^app\//, "")
    .replace(/\[bot\]$/, "")

const authorsMatch = (a: string, b: string): boolean =>
  normaliseLogin(a) === normaliseLogin(b)

// Same composition a plain substring search always matched against, so a
// single word filters exactly as before: title, repo, number, any decision a
// host flagged the row with; task rows search summary and key.
const searchText = (item: AnyItem): string =>
  item.kind === "pr" || item.kind === "issue"
    ? `${item.title} ${item.repo} #${item.number}${item.needsYou?.decision ? ` ${item.needsYou.decision}` : ""}`
    : item.kind === "task"
      ? `${item.summary} ${item.key}`
      : ""

const qualifierHolds = (
  item: AnyItem,
  key: "author" | "repo",
  value: string,
  login: string,
): boolean => {
  // Same normalisation both sides: one leading `@` from the typed value, and
  // `me`/`@ME` case-insensitively resolved to the login.
  const accountOf = (value: string): string => {
    const bare = value.toLowerCase().replace(/^@/, "")
    return bare === "me" ? login.toLowerCase() : bare
  }
  if (key === "author")
    return (
      (item.kind === "pr" || item.kind === "issue") &&
      item.author !== undefined &&
      authorsMatch(item.author, accountOf(value))
    )
  return (
    (item.kind === "pr" || item.kind === "issue") &&
    item.repo.toLowerCase().includes(value.toLowerCase())
  )
}

export const matchesSearchQuery = (
  item: AnyItem,
  terms: readonly QueryTerm[],
  login: string,
): boolean =>
  terms.every((term) => {
    const holds =
      term.kind === "text"
        ? searchText(item).toLowerCase().includes(term.value.toLowerCase())
        : qualifierHolds(item, term.key, term.value, login)
    return term.negate ? !holds : holds
  })
