import type { AnyItem, Section } from "./inbox.js"
import { keyOf } from "./diff.js"

/**
 * What an action did to a row, said before the server has agreed to it.
 *
 * Three shapes cover every action the inbox takes on a row: it leaves the list
 * (close, done), it changes tab (a Jira move), or it changes in place (labels,
 * assignee, read). A patch names the END STATE rather than the step that gets
 * there, which is what lets it be reapplied on top of every fetch: "SHOP-1234
 * belongs in review, wearing In Review" is as true on the third fetch as on the
 * first, where "move it one tab right" would walk it off the board.
 */
export type Patch =
  | { kind: "remove" }
  | { kind: "move"; toSection: string; fields?: Record<string, unknown> }
  | { kind: "mutate"; fields: Record<string, unknown> }

/**
 * One row's pending patch, and where its request stands.
 *
 * `inflight` is the window the `◌` covers: the request has not answered. `sent`
 * means it said yes and the patch is now only waiting for a fetch that agrees.
 * `failed` stays on screen exactly where the patch put it until the reader
 * restores it — the row does not snap back on its own, because a row that
 * silently returns to where it was reads as the action never having happened,
 * and the reader is left wondering whether they pressed the key at all.
 */
export type Override = {
  patch: Patch
  /** The verb, for the failure line: `Couldn't move SHOP-1234`. */
  action: string
  /** How the row is named in that line — a ticket key, `#412`. */
  label: string
  since: number
  phase: "inflight" | "sent" | "failed"
  /** `seq` orders failures newest first; two can land in the same millisecond. */
  failure?: { reason: string; seq: number }
}

/**
 * The upper bound on how long a patch outvotes a fetch that disagrees with it.
 *
 * NOT the mechanism. A patch clears the moment a fetch shows the server agrees,
 * which on Jira is usually the very next one; this only bounds the damage when
 * that fetch never comes — an index that lags longer than usual, or a request
 * that said yes to a transition a workflow post-function then undid. Thirty
 * seconds is several of Jira's search-index lags and still short enough that a
 * row is never wrong for long. In-flight and failed patches are exempt: the
 * first has not been answered yet, and the second is the reader's to restore.
 */
export const OVERRIDE_HOLD_MS = 30_000

const withFields = (item: AnyItem, fields?: Record<string, unknown>): AnyItem =>
  fields ? ({ ...item, ...fields } as AnyItem) : item

/**
 * A moved row lands at the END of its new tab, at the top level.
 *
 * Its depth belonged to the tree it left: a story at depth 1 under an epic,
 * appended under whatever happens to close the target tab, would claim a parent
 * it does not have. The next agreeing fetch puts it under its real one and in
 * its real sort position — the diff reads that as no news, because nothing the
 * row draws has changed.
 */
const placed = (item: AnyItem, fields?: Record<string, unknown>): AnyItem => {
  const row = withFields(item, fields) as AnyItem & {
    depth?: number
    indent?: boolean
  }
  return { ...row, depth: 0, indent: false } as AnyItem
}

const applyOne = (
  sections: Section[],
  key: string,
  patch: Patch,
): Section[] => {
  const found = sections
    .flatMap((s) => s.items)
    .find((item) => keyOf(item) === key)
  // Nothing to patch: the fetch no longer carries the row at all. Inventing it
  // back from memory is the snapshot replay a patch exists to avoid.
  if (!found) return sections
  if (patch.kind === "mutate")
    return sections.map((s) => ({
      ...s,
      items: s.items.map((item) =>
        keyOf(item) === key ? withFields(item, patch.fields) : item,
      ),
    }))
  const without = sections.map((s) => ({
    ...s,
    items: s.items.filter((item) => keyOf(item) !== key),
  }))
  if (patch.kind === "remove") return without
  // A tab the host did not send — it pushes only sections with rows — has no
  // label to give it, so the row stays where the server has it, wearing its
  // new fields. The fetch that brings the tab back brings the row with it.
  if (!without.some((s) => s.id === patch.toSection))
    return sections.map((s) => ({
      ...s,
      items: s.items.map((item) =>
        keyOf(item) === key ? withFields(item, patch.fields) : item,
      ),
    }))
  return without.map((s) =>
    s.id === patch.toSection
      ? { ...s, items: [...s.items, placed(found, patch.fields)] }
      : s,
  )
}

/**
 * Every pending patch, laid over a list.
 *
 * Over the FETCH, every time, and never spliced into what is on screen once:
 * a fetch that predates the action would otherwise put the row straight back,
 * and the diff would narrate the bounce as news. Run before `diffSections`, so
 * the transit marks, the union and the tab counts all see the patched list and
 * none of them needs to know a patch exists.
 */
export const applyOverrides = (
  sections: Section[],
  overrides: ReadonlyMap<string, Override>,
): Section[] =>
  [...overrides].reduce(
    (out, [key, override]) => applyOne(out, key, override.patch),
    sections,
  )

const fieldsMatch = (item: AnyItem, fields?: Record<string, unknown>) =>
  !fields ||
  Object.entries(fields).every(
    ([name, value]) => (item as Record<string, unknown>)[name] === value,
  )

/** Whether the server's list already says what the patch says. */
export const agrees = (
  sections: Section[],
  key: string,
  patch: Patch,
): boolean => {
  const at = sections.flatMap((s) =>
    s.items.filter((item) => keyOf(item) === key).map((item) => ({ s, item })),
  )
  if (patch.kind === "remove") return at.length === 0
  if (at.length === 0) return false
  if (patch.kind === "mutate")
    return at.every(({ item }) => fieldsMatch(item, patch.fields))
  return at.some(
    ({ s, item }) =>
      s.id === patch.toSection && fieldsMatch(item, patch.fields),
  )
}

/**
 * The patches a fresh fetch leaves standing.
 *
 * A patch the fetch agrees with has done its job and goes; one that has
 * outlived OVERRIDE_HOLD_MS goes too, and the fetch is believed. Failed and
 * in-flight patches stay whatever the fetch says — see `Override`.
 */
export const pruneOverrides = (
  overrides: ReadonlyMap<string, Override>,
  fresh: Section[],
  now: number,
  holdMs: number = OVERRIDE_HOLD_MS,
): Map<string, Override> =>
  new Map(
    [...overrides].filter(([key, override]) => {
      if (override.phase !== "sent") return true
      if (now - override.since > holdMs) return false
      return !agrees(fresh, key, override.patch)
    }),
  )

/** The failed patches, newest first — the order `w` restores them in. */
export const failedOverrides = (
  overrides: ReadonlyMap<string, Override>,
): [string, Override][] =>
  [...overrides]
    .filter(([, o]) => o.phase === "failed")
    .sort(([, a], [, b]) => (b.failure?.seq ?? 0) - (a.failure?.seq ?? 0))

/**
 * The one line every failure shares, newest first.
 *
 * Several failures stay one line: a stack of red lines would push the key hints
 * off the frame, and `w` only ever restores one at a time anyway, so the count
 * says how many presses are owed. No apology and no exclamation mark — the
 * reason and the way back are the whole message.
 */
export const failureNotice = (failed: [string, Override][]): string | null => {
  const newest = failed[0]?.[1]
  if (!newest) return null
  const more = failed.length > 1 ? `  +${failed.length - 1} more` : ""
  return `✗ Couldn't ${newest.action} ${newest.label}: ${
    newest.failure?.reason ?? "no reason reported"
  }${more}  w restore`
}
