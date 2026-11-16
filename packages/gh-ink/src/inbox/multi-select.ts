// ─── Multi-select helpers ─────────────────────────────────────────────────────
//
// Pure helpers for the inbox's multi-row selection: a range over ⇧↑/⇧↓, a
// single-row toggle on space, and the batch verbs over what a filter leaves
// visible. Beside `inbox.tsx` rather than inside it so they can be pinned
// without mounting Ink, and so `pr-row.tsx` can draw the selected gutter.
//
// Only TYPES come back from `inbox.tsx`. The row identity is passed in as
// `keyOf` (the inbox hands over its own `rowKey`) rather than imported, so this
// module never becomes the second copy of that rule, and never a runtime cycle
// either: `inbox.tsx` and `pr-row.tsx` both import values from here.

import type { AnyItem } from "./inbox.js"

type KeyOf = (item: AnyItem) => string

/**
 * Whether a row can be selected at all: the three kinds that are a piece of
 * work. Everything else is furniture — a repo fence and a band header already
 * act for themselves (`o` opens the fence, `c` copies the band), and show-more
 * / show-less stand for rows rather than being one. A selection that could take
 * a header would make `o` open a repo page among the PRs, and the count would
 * stop matching anything the reader can point at.
 */
export const isSelectable = (item: AnyItem | undefined): item is AnyItem =>
  item?.kind === "pr" || item?.kind === "issue" || item?.kind === "task"

/**
 * Keys of the selectable rows between two indices, inclusive, either order.
 * Read over the DRAWN list, so with a search on, extending a range takes what
 * is on screen; headers in between are skipped rather than claimed, the way the
 * cursor skips them.
 */
export const rangeKeys = (
  items: readonly AnyItem[],
  fromIdx: number,
  toIdx: number,
  keyOf: KeyOf,
): string[] => {
  const keys: string[] = []
  const end = Math.min(Math.max(fromIdx, toIdx), items.length - 1)
  for (let i = Math.max(0, Math.min(fromIdx, toIdx)); i <= end; i++) {
    const item = items[i]
    if (isSelectable(item)) keys.push(keyOf(item))
  }
  return keys
}

/**
 * The rows of `items` whose key is selected, in LIST order rather than the
 * Set's: the clipboard should read the way the screen does, not the order the
 * keystrokes happened to build the set in. Reading the drawn list is also what
 * keeps a row a search has hidden out of the batch, and a row a refresh has
 * removed out of the count.
 */
export const selectedRows = (
  items: readonly AnyItem[],
  keys: ReadonlySet<string>,
  keyOf: KeyOf,
): AnyItem[] =>
  keys.size === 0
    ? []
    : items.filter((item) => isSelectable(item) && keys.has(keyOf(item)))

/**
 * The rows' URLs, de-duplicated, in order. A ticket drawn under two bands is
 * one destination, and the N in the flash is a promise about how many tabs open
 * or how many lines land in the clipboard.
 */
export const selectedUrls = (rows: readonly AnyItem[]): string[] => [
  ...new Set(rows.flatMap((row) => ("url" in row && row.url ? [row.url] : []))),
]

/**
 * The two-column cursor gutter. The cursor keeps column 0 (`❯`) and the
 * selection takes column 1 (`●`), which nothing else in the list draws in, so
 * selecting a row shifts nothing sideways and an unselected row draws exactly
 * the bytes it always did. The glyph is what carries the state: the wash behind
 * it is a hint for colour terminals, and a piped frame has none.
 */
export const selectionGutter = (active: boolean, selected: boolean): string =>
  (active ? "❯" : " ") + (selected ? "●" : " ")
