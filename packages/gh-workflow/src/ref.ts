// A typed reference → a row, through the same mapper every listed row takes.
//
// The fetch is HANDED IN rather than imported, and that is what keeps this
// package what `imports.test.ts` says it is: importable from a browser, with
// no transport of its own. `@kud/gh`'s `fetchItemNode` is the fetch a terminal
// host passes; a web host would pass its own. Only the parse is imported, from
// the transport-free `@kud/gh/ref` subpath.

import { parseRef } from "@kud/gh/ref"
import type { GHItem } from "./core.js"
import { toGHItem } from "./map.js"

/** One PR or issue node by repo and number, or `null` for not found / no access. */
export type FetchItemNode = (
  repo: string,
  number: number,
) => Promise<any | null>

export type ResolveRefOptions = {
  fetchNode: FetchItemNode
  /** Tried first for a bare `#N`: the repo of the row the viewer is on. */
  activeRepo?: string
  /** Tried next, in order: the repos the inbox already holds. */
  repos?: readonly string[]
}

/**
 * The repos a bare `#N` is tried against, in order: the active row's first,
 * because "#12" typed while standing on a row almost always means that row's
 * repo; then everything else the inbox holds. Deduped case-insensitively, so
 * the active repo is not asked about twice when the inbox holds it too — each
 * try is a round trip.
 */
export const refCandidates = (
  activeRepo: string | undefined,
  repos: readonly string[] = [],
): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const repo of [activeRepo, ...repos]) {
    if (!repo || seen.has(repo.toLowerCase())) continue
    seen.add(repo.toLowerCase())
    out.push(repo)
  }
  return out
}

/**
 * Resolve a URL, `owner/repo#N` or bare `#N` to a row, or `null` when nothing
 * by that number exists where it was looked for (or the viewer cannot see it).
 *
 * The row's kind comes from the fetched node's `__typename`, through
 * `toGHItem` — never from the text. See `ParsedRef` for why the text cannot
 * know.
 *
 * Candidates are tried one at a time and the first hit wins, so a `#12` that
 * exists in two repos opens the one nearest the viewer rather than racing.
 * A thrown fetch is not a miss: it propagates, and the remaining candidates
 * are not tried, because "could not ask" is not "is not there".
 *
 * Throws on input that is not a reference at all — a caller should only get
 * here through `parseRef` having said yes.
 */
export const resolveRef = async (
  input: string,
  { fetchNode, activeRepo, repos }: ResolveRefOptions,
): Promise<GHItem | null> => {
  const ref = parseRef(input)
  if (!ref) throw new Error(`"${input}" is not a PR or issue reference`)
  const candidates = ref.repo ? [ref.repo] : refCandidates(activeRepo, repos)
  for (const repo of candidates) {
    const node = await fetchNode(repo, ref.number)
    if (node) return toGHItem(node)
  }
  return null
}
