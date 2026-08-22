import type { AnyItem, GHItem, JiraRow, Section } from "./inbox.js"

/** What happened to a row between two fetches. */
export type Transient = "in" | "out" | "changed"

// Stable identity for a row across fetches: the URL for anything from GitHub,
// the ticket URL (or key) for Jira.
//
// Headers, show-more and show-less deliberately have NO identity. They are
// computed from the rows around them - a repo header appears because its first
// row arrived, and vanishes because its last one left. Giving them synthetic
// keys would report every one of those as news in its own right, so a single
// arriving PR would announce itself twice.
export const keyOf = (item: AnyItem): string | null => {
  if (item.kind === "pr" || item.kind === "issue") return (item as GHItem).url
  if (item.kind === "jira") {
    const row = item as JiraRow
    return row.url || `jira:${row.key}`
  }
  return null
}

// Only what the row actually draws.
//
// A change the reader cannot see is not a change worth flagging, and most of
// the item is invisible: `age`/`activityAge` are relative strings that drift on
// every fetch, `ts` moves whenever anything touches the item, and `detail` is
// filled lazily by the drill view. Any of them in the comparison would mark
// rows as changed while they look identical on screen - which is worse than no
// marker at all, because it teaches you to ignore the one that means something.
//
// Same reasoning `signatureOf` applies when it drops `age`, one level finer: it
// asks whether the LIST changed, this asks whether a ROW did.
const renderedState = (item: AnyItem): string => {
  if (item.kind === "pr" || item.kind === "issue") {
    const i = item as GHItem
    return [
      i.title,
      i.health,
      i.unresolved,
      i.conversation,
      i.lastActor ?? "",
      i.author ?? "",
    ].join("|")
  }
  if (item.kind === "jira") {
    const j = item as JiraRow
    return [j.summary, j.jiraStatus].join("|")
  }
  return ""
}

type Placed = { item: AnyItem; sectionId: string; index: number }

const indexRows = (sections: Section[]): Map<string, Placed> => {
  const out = new Map<string, Placed>()
  for (const section of sections) {
    section.items.forEach((item, index) => {
      const key = keyOf(item)
      if (key) out.set(key, { item, sectionId: section.id, index })
    })
  }
  return out
}

export type DiffResult = {
  /** Row key to what happened to it. Rows absent from this map are unchanged. */
  transients: Map<string, Transient>
  /**
   * `next`, with departing rows spliced back in at the position they held in
   * `prev`. This is what gets rendered for the hold, so a row you are watching
   * leaves from where it actually was rather than teleporting to the end.
   */
  union: Section[]
  counts: { added: number; removed: number; changed: number }
}

// Departing rows go back into the section they left, at the index they held.
// A row whose whole section is gone is dropped rather than resurrected: the
// section header would have to come back with it, and a section reappearing for
// two seconds to show you something leaving reads as an arrival, not a
// departure - the exact opposite of what it is trying to say.
const spliceBack = (next: Section[], leaving: Placed[]): Section[] => {
  if (leaving.length === 0) return next
  const bySection = new Map<string, Placed[]>()
  for (const row of leaving) {
    const list = bySection.get(row.sectionId)
    if (list) list.push(row)
    else bySection.set(row.sectionId, [row])
  }
  return next.map((section) => {
    const rows = bySection.get(section.id)
    if (!rows) return section
    const items = [...section.items]
    // Ascending, so each splice lands before the next one is measured.
    for (const row of [...rows].sort((a, b) => a.index - b.index))
      items.splice(Math.min(row.index, items.length), 0, row.item)
    return { ...section, items }
  })
}

/**
 * Classify every row between two renders of the list.
 *
 * Called with the sections currently on screen and the ones about to replace
 * them. The caller renders `union` with `transients` for the hold, then settles
 * onto `next`.
 */
export const diffSections = (prev: Section[], next: Section[]): DiffResult => {
  const before = indexRows(prev)
  const after = indexRows(next)
  const transients = new Map<string, Transient>()
  const leaving: Placed[] = []

  for (const [key] of after) if (!before.has(key)) transients.set(key, "in")

  for (const [key, was] of before) {
    const now = after.get(key)
    if (!now) {
      transients.set(key, "out")
      leaving.push(was)
    } else if (renderedState(was.item) !== renderedState(now.item)) {
      transients.set(key, "changed")
    }
  }

  let added = 0
  let removed = 0
  let changed = 0
  for (const [, kind] of transients) {
    if (kind === "in") added++
    else if (kind === "out") removed++
    else changed++
  }

  return {
    transients,
    union: spliceBack(next, leaving),
    counts: { added, removed, changed },
  }
}

/**
 * `2 new / 1 gone / 3 moved`, or "" when nothing moved.
 *
 * Words, never colour alone - the header indicator has to survive being read by
 * someone who cannot separate the orange from the grey, which is the same rule
 * the MERGED label follows.
 */
export const summariseDiff = (counts: DiffResult["counts"]): string => {
  const parts: string[] = []
  if (counts.added) parts.push(`${counts.added} new`)
  if (counts.removed) parts.push(`${counts.removed} gone`)
  if (counts.changed) parts.push(`${counts.changed} moved`)
  return parts.join(" · ")
}

/** What the last refresh did to this row, if anything. */
export const transientOf = (
  transients: Map<string, Transient> | undefined,
  item: AnyItem,
): Transient | undefined => {
  if (!transients?.size) return undefined
  const key = keyOf(item)
  return key ? transients.get(key) : undefined
}
