// What a pasted GitHub reference points at, read off the text alone.
//
// Pure and transport-free on purpose, and exported on its own subpath
// (`@kud/gh/ref`) for the same reason `health` is: `@kud/gh-workflow` resolves
// references and must stay importable from a browser bundle, so the thing it
// parses with cannot drag `execa` in behind it. The fetch half lives in
// `inbox.ts`, beside the selections it has to share.

/**
 * A reference as typed. `repo` is absent for a bare `#N`, which only the
 * caller can expand — it knows which row is active and which repos the inbox
 * holds; this file knows neither.
 *
 * There is deliberately no PR-or-issue flag. A URL says which, but
 * `owner/repo#N` and `#N` do not, and GitHub numbers both from one sequence —
 * so any guess here is a coin toss the fetched node then has to overrule. The
 * first draft of this type carried `isPr: true` for the shorthand forms and
 * opened every issue typed that way as a PR. The node's `__typename` is the
 * only honest answer, and `toGHItem` already reads it.
 */
export type ParsedRef = {
  repo?: string
  number: number
}

// GitHub's own rules, near enough: owners are alphanumeric and hyphens, repo
// names add `.` and `_`. Tight on purpose — the launcher calls this on every
// keystroke, and a loose pattern would claim half-typed ticket keys.
const SLUG = "([A-Za-z0-9-]+/[A-Za-z0-9_.-]+)"

// Anything after the number — `/files`, `#issuecomment-…`, `?w=1` — is a view
// of the same item, so a URL copied from any tab of it still resolves.
const URL_RE = new RegExp(
  `^https?://(?:www\\.)?github\\.com/${SLUG}/(?:pull|issues)/(\\d+)(?:[/?#].*)?$`,
  "i",
)
const SHORTHAND_RE = new RegExp(`^${SLUG}#(\\d+)$`)
const BARE_RE = /^#(\d+)$/

/**
 * Parse a PR or issue reference: a github.com URL, `owner/repo#N`, or a bare
 * `#N`. Anything else — a ticket key, a word, a half-typed slug — is `null`,
 * which is how the launcher knows the input is not GitHub's to claim.
 *
 * The repo keeps the case it was typed in, because it is also what the
 * launcher shows back. GitHub matches names case-insensitively, so every
 * comparison against it has to as well.
 */
export const parseRef = (input: string): ParsedRef | null => {
  const text = input.trim()
  const match = URL_RE.exec(text) ?? SHORTHAND_RE.exec(text)
  if (match) return { repo: match[1], number: Number(match[2]) }
  const bare = BARE_RE.exec(text)
  return bare ? { number: Number(bare[1]) } : null
}

/** `owner/repo#N`, or `#N` while the repo is still unknown. */
export const formatRef = (ref: ParsedRef): string =>
  `${ref.repo ?? ""}#${ref.number}`
