import type { AnyItem, GHItem, Section } from "./inbox.js"
import { keyOf } from "./diff.js"

/**
 * How often the rows still settling are asked about again.
 *
 * Thirty seconds is the issue's own number and it is priced, not guessed: one
 * `nodes(ids:)` document costs about 0.56 points per PR, so a handful of
 * running checks is one or two points a tick, against the ~73 a full fetch
 * costs. The poll runs ONLY while a row is settling — see `settlingRows` — so an
 * idle hour with nothing pending spends nothing at all, which is the other half
 * of the same budget.
 */
export const LIVE_POLL_MS = 30_000

/**
 * How long the keyboard must be quiet before a row is allowed to change GROUP.
 *
 * Status ticks in place at once: a glyph turning from running to passed moves
 * nothing, and holding it back would only leave a stale verdict on screen. A
 * row leaving "Their move" for "Your move" is different — it shifts every row
 * beneath it, and a list that reshuffles between two keypresses is the exact
 * failure the manual `r apply` gate was built to prevent. So the regroup waits
 * for a pause in typing, and then travels with the existing transit marks so
 * the move is narrated rather than silent.
 *
 * Four seconds is long enough to span the gap between keys of someone working
 * a list (arrowing, reading, acting) and short enough that someone who has
 * stopped to look sees the move within the same glance. Far under
 * PULSE_IDLE_MS, which measures a different thing: a person ARRIVING.
 */
export const LIVE_QUIET_MS = 4_000

const isGH = (item: AnyItem): item is GHItem =>
  item.kind === "pr" || item.kind === "issue"

/**
 * The PRs whose verdict is still moving on its own: checks running, nobody
 * needing to touch anything for the answer to change.
 *
 * `pending` alone, deliberately. Every other token waits on a PERSON — a
 * review, a push, a reply — and a person's move arrives through the full fetch
 * or the notifications probe, not through a timer that would poll a board of
 * approved PRs forever and spend the budget on rows that cannot change by
 * themselves.
 *
 * Deduplicated by URL because cockpit draws one PR in several tabs by design,
 * and asking about it twice would pay twice for one answer.
 */
export const settlingRows = (sections: readonly Section[]): GHItem[] => {
  const seen = new Map<string, GHItem>()
  for (const section of sections)
    for (const item of section.items)
      if (
        isGH(item) &&
        item.kind === "pr" &&
        item.health === "pending" &&
        !seen.has(item.url)
      )
        seen.set(item.url, item)
  return [...seen.values()]
}

/*
 * What a section's rows are and in which order — and nothing about what they
 * say. Headers count by kind and label, so a band that appears or empties is a
 * placement change too: a row moving from Their move into an empty Your move
 * brings its header with it.
 */
const placementOf = (sections: readonly Section[]): string =>
  JSON.stringify(
    sections.map((s) => [
      s.id,
      s.items.map(
        (item) =>
          keyOf(item) ??
          `${item.kind}:${(item as { label?: string }).label ?? ""}`,
      ),
    ]),
  )

/** Whether two lists hold the same rows in the same places, whatever the rows say. */
export const samePlacement = (
  a: readonly Section[],
  b: readonly Section[],
): boolean => placementOf(a) === placementOf(b)

/**
 * The displayed list, wearing the fresh list's row CONTENT without taking its
 * row ORDER.
 *
 * This is how a verdict ticks without the list moving: the row under the cursor
 * stays on the line it was on, and only its status changes. Layout fields — the
 * tree depth a row was drawn at — stay with the displayed row, because they are
 * a fact about where the row stands, and where it stands is exactly what this
 * is promising not to change.
 *
 * A displayed row the fresh list no longer carries is left as it was. Its
 * departure is a placement change, and placement changes belong to the regroup,
 * which narrates them.
 */
export const patchInPlace = (
  displayed: readonly Section[],
  fresh: readonly Section[],
): Section[] => {
  const byKey = new Map<string, GHItem>()
  for (const section of fresh)
    for (const item of section.items)
      if (isGH(item) && !byKey.has(item.url)) byKey.set(item.url, item)

  return displayed.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (!isGH(item)) return item
      const match = byKey.get(item.url)
      if (!match || match === item) return item
      const out: GHItem = { ...match }
      if ("depth" in item) out.depth = item.depth
      else delete out.depth
      if ("indent" in item) out.indent = item.indent
      else delete out.indent
      return out
    }),
  }))
}

/** How long until a held regroup may land, or 0 when it may land now. */
export const regroupWait = (
  lastKeyAt: number,
  now = Date.now(),
  quietMs = LIVE_QUIET_MS,
): number => Math.max(0, lastKeyAt + quietMs - now)
