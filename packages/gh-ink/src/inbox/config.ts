// Host-supplied opinions.
//
// Everything here was once a constant compiled into the inbox: which repos to
// rank first, which ones counted as a separate part of the reader's life, where
// checkouts were kept on disk. None of that is a property of GitHub, and a
// library published to a registry cannot hold any of it — a ranking baked in at
// build time ranks one reader's repos above its next reader's.
//
// Set once at startup, before the first render, because it is process-global by
// nature: one reader, one machine, one arrangement of checkouts. Threading it
// through layoutGHItems → sortItems → repoPriority, and again through every
// filter that re-lays a section, would put a parameter on nine functions to
// carry a value that cannot vary within a run.
//
// Every default is empty. A host that configures nothing gets flat repo
// ordering, no profile split and no local-checkout resolution — never a guess at
// where someone keeps their code.

/**
 * A named slice of the reader's repos. Two or more turn on the in-app toggle;
 * one or none means an undivided set and no toggle at all.
 *
 * Named rather than boolean because the distinction was never a property of a
 * repo — it is whatever separation the reader actually keeps, and a boolean
 * leaves a third slice nowhere to go.
 */
export type RepoProfile = {
  /** Stable id — what `--profile=<name>` selects. */
  name: string
  /** Shown on the toggle. Defaults to `name`. */
  label?: string
  /** Which repos belong to this profile. */
  match: (repo: string) => boolean
  /** Where this profile's checkouts live, if it keeps its own directory. */
  checkoutDir?: string
}

export type InboxConfig = {
  /**
   * Repo ranking, best first. An entry ending in `/` matches by owner prefix,
   * anything else must equal `owner/name` exactly — so a single repo can outrank
   * the owner that contains it. Repos matching nothing sort last, together.
   */
  repoPriority: readonly string[]
  /**
   * Label ranking, best first, deciding which two labels a row shows when it
   * carries more than two. An entry ending in `*` matches by prefix; anything
   * else must equal the label name exactly. Labels matching nothing share the
   * last rank and are ordered among themselves by name.
   *
   * Empty like everything else here, and that is load-bearing rather than
   * merely consistent: `plan`, `spike` and `app:*` are one reader's filing
   * conventions, invented in their own notes, and a library that shipped them
   * as defaults would be ranking a stranger's labels by a scheme they have
   * never seen. Empty means a labelled row shows its labels in name order,
   * which is honest about knowing nothing.
   */
  labelPriority: readonly string[]
  profiles: readonly RepoProfile[]
  /**
   * Fallback directory holding checkouts, for repos in no profile that names one
   * of its own. Unset means local checkouts are not resolved at all, which is
   * correct for a host that only ever opens things in a browser.
   */
  checkoutDir?: string
  /**
   * Directory name the on-disk cache lives under, inside the platform cache
   * root. Defaults to this package's name — a library has no business claiming a
   * directory named after whichever tool happens to embed it, and two hosts on
   * one machine would otherwise share a cache keyed only by section name.
   */
  cacheNamespace: string
  /**
   * How long a cached inbox is trusted before a launch refetches. Every launch
   * past it pays the full query — eight searches with check rollups — so this is
   * the single knob between "always current" and "always slow, and drawing 502s
   * from the API".
   *
   * It can be generous because staleness is bounded from the other end: acting
   * on a row drops the entry outright, and `r` refetches on demand. What the TTL
   * actually governs is how long a change made ELSEWHERE — someone approving
   * your PR while you were not looking — can go unseen, which is a glance
   * arriving late, not a wrong action taken.
   */
  cacheTtlMs: number
}

const EMPTY: InboxConfig = {
  repoPriority: [],
  labelPriority: [],
  profiles: [],
  cacheNamespace: "gh-ink",
  cacheTtlMs: 600_000,
}

let current: InboxConfig = EMPTY

/** Supply the host's opinions. Call once, before rendering. */
export const configureInbox = (config: Partial<InboxConfig>): void => {
  current = { ...EMPTY, ...config }
}

export const inboxConfig = (): InboxConfig => current

/** Test seam — restores the empty defaults. */
export const resetInboxConfig = (): void => {
  current = EMPTY
}

/** The profile a repo belongs to, or null when none claims it. */
export const profileOf = (repo: string): RepoProfile | null =>
  current.profiles.find((p) => p.match(repo)) ?? null

/**
 * Where checkouts are searched, in order: every profile that names its own
 * directory, then the fallback. Deduped, since the ordinary single-directory
 * case points them all at the same place. Empty when nothing is configured —
 * callers treat that as "not checked out locally", which it truthfully is.
 */
export const checkoutDirs = (): string[] => [
  ...new Set([
    ...current.profiles.flatMap((p) => p.checkoutDir ?? []),
    ...(current.checkoutDir ? [current.checkoutDir] : []),
  ]),
]
