import { depthOf } from "@kud/gh-workflow"
import type { AnyItem } from "@kud/gh-workflow"

// The tree walks that more than one module needs, in a leaf of their own.
// `inbox.tsx` is where they are read most, but `overrides.ts` and `diff.ts`
// need them too, and both of those import nothing but types from the inbox
// today: a value import would make each of them load the whole 8,000-line
// screen, and close a cycle through `diff.js` that is safe only for as long as
// nothing at the inbox's top level happens to call into it.

// Where an item sits in the TREE, which for a band header is nowhere: it fences
// trees rather than hanging in one. A header's own depth is a heading level —
// `layoutSides` puts its bands at 1 under a side at 0 — and read as a tree depth
// that level made the last PR of every band open a branch (`┬`) into the next
// band's header, a child before it close with `├─` as if a sibling followed, and
// the tab count skip that PR as a container. So every tree walk below reads
// this, and only the heading logic (`bandUrls`, the gap between a side and its
// first band, the header's render) reads `depthOf` on a header.
export const treeDepthOf = (item?: AnyItem): number =>
  item?.kind === "subgroup-header" ? 0 : depthOf(item)

/**
 * Where the rows that travel WITH `items[i]` end: the exclusive end of its block.
 *
 * A ticket's PRs hang under it and have no tab of their own — they sit in a
 * stage because their ticket does. Every place that takes a ticket out of a tab
 * used to take it out one row at a time, by key, and the PR rows had other keys,
 * so they stayed behind: orphans at depth 1 drawing tree corners under a band
 * heading, and two of them from different tickets joined into siblings by the
 * corner walk, which reads a flat list and has no way to know they were never
 * related. That is what a move or a landed ticket looked like until 2026-11-02.
 * So the move, the remove, the counts and the transit marks all cut the same
 * span, and this is the one definition of it.
 *
 * The walk takes every row deeper than the head and stops at the first row at
 * its depth or shallower, at any header, or at any `task`. The task term is what
 * keeps the block to what really follows the head: an epic's stories are tickets
 * in their own right with their own Jira status, and moving the epic must not
 * drag them into a stage they are not in, so an epic takes nothing beyond PRs
 * linked to it directly. A story takes its PRs and their show-more. A PR, an
 * issue or a show-more has nothing hanging off it, so it is a block of one — a
 * leaf removal stays exactly the leaf removal it always was.
 *
 * `treeUrls` walks forward the same way to decide what `C` copies, but stops
 * only on depth: copying a tree and moving a block are different questions, and
 * an epic's `C` is meant to take its stories' PRs too.
 */
export const blockEnd = (items: readonly AnyItem[], i: number): number => {
  const head = items[i]
  if (!head) return i
  if (head.kind !== "task") return i + 1
  const depth = treeDepthOf(head)
  let j = i + 1
  while (j < items.length) {
    const item = items[j]!
    if (
      item.kind === "repo-header" ||
      item.kind === "subgroup-header" ||
      item.kind === "task" ||
      treeDepthOf(item) <= depth
    )
      break
    j += 1
  }
  return j
}

/**
 * `items` without every block whose head `matches`, cut by POSITION.
 *
 * By position because a child's own key says nothing about which head it hangs
 * under: a PR's key is its URL, and the same PR can sit under two tickets, or
 * under both copies of one ticket drawn twice in a tab (see `instanceKey`).
 * Filtering children by key would take a PR out from under a ticket that is
 * staying, and filtering heads by key alone is the orphaning `blockEnd` exists
 * to end.
 */
export const withoutBlocks = (
  items: readonly AnyItem[],
  matches: (item: AnyItem) => boolean,
): { kept: AnyItem[]; cut: AnyItem[][] } => {
  const kept: AnyItem[] = []
  const cut: AnyItem[][] = []
  let i = 0
  while (i < items.length) {
    const item = items[i]!
    if (!matches(item)) {
      kept.push(item)
      i += 1
      continue
    }
    const end = blockEnd(items, i)
    cut.push(items.slice(i, end))
    i = end
  }
  return { kept, cut }
}

/**
 * Every row that hangs from nothing, drawn at the top level instead.
 *
 * A backstop, not a layout rule. Since `blockEnd` a head no longer leaves its
 * children behind, but a host can still hand over a depth-1 row with nothing
 * above it — a search that kept a PR and hid its ticket, a producer with a bug
 * in its nesting — and the corner walk will draw it as a child of whatever the
 * header above happens to be, and join two such rows from different trees into
 * siblings, which is the exact picture the orphaned PRs made under a stage band.
 * Drawn flat it is still on screen and still actionable; HIDDEN it would be
 * work quietly missing from a tab, which no picture can make up for.
 *
 * An ancestor is any non-header row shallower than this one, found before the
 * nearest header. Read off the ORIGINAL depths rather than the rebased ones, so
 * two orphans in a row both flatten: rebasing the first and then measuring the
 * second against it would hang the second under the first and draw exactly
 * the false sibling pair this exists to prevent.
 *
 * Answers the same array when nothing is orphaned, so a memo downstream sees
 * no change on the ordinary, healthy list.
 */
export const rootOrphans = (
  items: readonly AnyItem[],
): { items: readonly AnyItem[]; orphans: AnyItem[] } => {
  const orphans: AnyItem[] = []
  let out: AnyItem[] | undefined
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!
    if (item.kind === "repo-header" || item.kind === "subgroup-header") continue
    const depth = treeDepthOf(item)
    if (depth === 0) continue
    let owned = false
    for (let j = i - 1; j >= 0; j -= 1) {
      const above = items[j]!
      if (above.kind === "repo-header" || above.kind === "subgroup-header")
        break
      if (treeDepthOf(above) < depth) {
        owned = true
        break
      }
    }
    if (owned) continue
    orphans.push(item)
    out ??= [...items]
    out[i] = { ...item, depth: 0, indent: false } as AnyItem
  }
  return { items: out ?? items, orphans }
}
