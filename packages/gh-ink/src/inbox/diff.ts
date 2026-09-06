import type { AnyItem, GHItem, TaskRow, Section } from "./inbox.js"

/**
 * What happened to a row between two fetches, IN ONE TAB.
 *
 * Five rather than three, because "gone" and "left this tab" are not the same
 * news and a marker that conflates them lies about work that is still on the
 * board. A row that moves between tabs is marked twice - `moved-out` where it
 * was, `moved-in` where it landed - so it dissolves in the tab you were reading
 * and coalesces in the one it went to. `in` and `out` keep their stronger
 * meaning: arrived on the board, left it altogether.
 */
export type Transient = "in" | "out" | "changed" | "moved-in" | "moved-out"

// A mark belongs to a row IN A SECTION, not to a row. The separator is NUL
// because no section id or URL can contain one, so the two halves always split
// back out cleanly.
const MARK_SEP = "\u0000"

/** The mark key for `row` as drawn in `sectionId`. */
export const markKey = (sectionId: string, rowKey: string): string =>
  `${sectionId}${MARK_SEP}${rowKey}`

/** The row identity back out of a mark key. */
export const rowKeyOfMark = (mark: string): string =>
  mark.slice(mark.indexOf(MARK_SEP) + 1)

/** The section a mark belongs to. */
export const sectionIdOfMark = (mark: string): string =>
  mark.slice(0, mark.indexOf(MARK_SEP))

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
  if (item.kind === "task") {
    const row = item as TaskRow
    return row.url || `task:${row.key}`
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
  if (item.kind === "task") {
    const j = item as TaskRow
    return [j.summary, j.status].join("|")
  }
  return ""
}

type Placed = { item: AnyItem; sectionId: string; index: number }

// Keyed per SECTION, not per row, because "is this row still here" is a question
// about a tab and the old board-wide index could not ask it. A block that moved
// from one tab to another was present in both snapshots, so it earned no mark at
// all and simply vanished from the tab you were reading - worst of all for an
// epic, whose own summary and status never change because it moves only when its
// children do. Cockpit also draws one epic in two tabs at once by design; a
// board-wide key gave those two instances one shared mark.
const indexRows = (sections: Section[]): Map<string, Placed> => {
  const out = new Map<string, Placed>()
  for (const section of sections) {
    section.items.forEach((item, index) => {
      const key = keyOf(item)
      if (key)
        out.set(markKey(section.id, key), {
          item,
          sectionId: section.id,
          index,
        })
    })
  }
  return out
}

// Which rows are on the board at all, ignoring which tab holds them. The marks
// are per tab; the COUNTS are not - a block moving between tabs is one thing
// that happened, and reporting it as "1 gone · 1 new" would double-count a
// single move in the one place that has to stay a headline.
const rowsOf = (index: Map<string, Placed>): Map<string, Set<string>> => {
  const out = new Map<string, Set<string>>()
  for (const [mark, placed] of index) {
    const key = rowKeyOfMark(mark)
    const seen = out.get(key)
    if (seen) seen.add(placed.sectionId)
    else out.set(key, new Set([placed.sectionId]))
  }
  return out
}

const sameSections = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id))

export type DiffResult = {
  /**
   * Mark key (see `markKey`) to what happened to that row in that tab. Rows
   * absent from this map are unchanged.
   */
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
  const boardBefore = rowsOf(before)
  const boardAfter = rowsOf(after)
  const transients = new Map<string, Transient>()
  const leaving: Placed[] = []

  /* Where a section is a SAMPLE of a larger set, presence carries no news.
   *
   * Arrivals and departures are inferred from one fetch against the next, which
   * answers "what changed in the world?" only while the window and the world are
   * the same size. Behind a sampled section they are not: 95 issues competing for
   * 30 slots means any update to any of them reorders the window and evicts one,
   * and the row that fell out never moved. Marking it `out` — and marking
   * whatever took its place `in` — is the board reporting its own scrolling as
   * news, every fetch, all day. That is what a reader experiences as flicker, and
   * the marks that DO mean something get read as more of the same.
   *
   * `changed` is deliberately still raised here. Truncation corrupts which rows
   * you can see, never what a row you can see says — a title, a health token or a
   * review state that moved between two fetches is real news about a row that was
   * present in both, and suppressing it would throw away the half of the signal
   * that still works.
   *
   * A section marks itself, so a whole section beside a sampled one keeps its
   * arrivals: the noise is quarantined to where it comes from.
   */
  const sampled = new Set(
    next
      .concat(prev)
      .filter((s) => s.sampled)
      .map((s) => s.id),
  )
  const isSampled = (mark: string) => sampled.has(sectionIdOfMark(mark))

  // Arriving in this tab. Whether that is news about the BOARD depends on where
  // the row was a moment ago: on it already means the row travelled, and saying
  // NEW to a ticket you have been watching for a fortnight is the marker lying.
  for (const [mark] of after)
    if (!before.has(mark) && !isSampled(mark))
      transients.set(
        mark,
        boardBefore.has(rowKeyOfMark(mark)) ? "moved-in" : "in",
      )

  for (const [mark, was] of before) {
    const now = after.get(mark)
    if (!now) {
      // Still spliced back in for the hold even when the mark is suppressed:
      // `leaving` is what keeps a row on screen where it was, and a row that
      // vanishes mid-read is the jarring half of this whether or not anything
      // is drawn beside it.
      if (!isSampled(mark))
        transients.set(
          mark,
          boardAfter.has(rowKeyOfMark(mark)) ? "moved-out" : "out",
        )
      leaving.push(was)
    } else if (renderedState(was.item) !== renderedState(now.item)) {
      transients.set(mark, "changed")
    }
  }

  // Counted per ROW, so one move is one headline however many tabs it touched -
  // and so an epic drawn in two tabs at once is not reported twice for the one
  // edit.
  let added = 0
  let removed = 0
  const changedRows = new Set<string>()
  for (const [mark, kind] of transients)
    if (kind === "changed") changedRows.add(rowKeyOfMark(mark))
  // The headline needs the same quarantine as the marks, and needs it more: a
  // row can carry a suppressed mark quietly, but "12 new · 9 gone" in the header
  // is the loudest thing on screen and it was counting the window scrolling.
  // A row is only ignored when EVERY section holding it is sampled — one that
  // also sits in a whole section really did arrive, and still counts there.
  const onlySampled = (sections: Set<string>) =>
    sections.size > 0 && [...sections].every((id) => sampled.has(id))

  for (const [key, sections] of boardAfter) {
    const had = boardBefore.get(key)
    if (!had) {
      if (!onlySampled(sections)) added += 1
    } else if (!sameSections(had, sections)) changedRows.add(key)
  }
  for (const [key, sections] of boardBefore)
    if (!boardAfter.has(key) && !onlySampled(sections)) removed += 1

  return {
    transients,
    union: spliceBack(next, leaving),
    counts: { added, removed, changed: changedRows.size },
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

/**
 * What the last refresh did to this row IN THIS TAB, if anything.
 *
 * The section id is not optional and cannot be defaulted: a row drawn in two
 * tabs has two answers, and the whole point of the per-tab marks is that they
 * can differ - `moved-out` where it was, `moved-in` where it went.
 */
export const transientOf = (
  transients: Map<string, Transient> | undefined,
  item: AnyItem,
  sectionId: string,
): Transient | undefined => {
  if (!transients?.size) return undefined
  const key = keyOf(item)
  return key ? transients.get(markKey(sectionId, key)) : undefined
}

/**
 * Mark key → the id of the section (tab) the row sits in, for every key in
 * `marks`.
 *
 * Built from the union rather than from `next`, so a departing row is filed
 * under the tab it is still standing in. The hold is spent per tab, and a tab
 * cannot settle without knowing which rows belong to it.
 */
export const tabsOfMarks = (
  sections: Section[],
  marks: Map<string, Transient>,
): Map<string, string> => {
  const out = new Map<string, string>()
  for (const section of sections)
    for (const item of section.items) {
      const key = keyOf(item)
      if (!key) continue
      const mark = markKey(section.id, key)
      if (marks.has(mark)) out.set(mark, section.id)
    }
  return out
}
