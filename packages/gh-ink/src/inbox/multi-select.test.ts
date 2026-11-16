import { describe, expect, it } from "vitest"
import {
  MULTI_SELECT_BG,
  rowBackground,
  rowKey,
  SELECTION_BG,
  type AnyItem,
} from "./inbox.js"
import {
  isSelectable,
  rangeKeys,
  selectedRows,
  selectedUrls,
  selectionGutter,
} from "./multi-select.js"

// The pure half of the multi-select. The keys themselves are pinned on a
// mounted inbox in multi-select.test.tsx; this file pins the decisions they
// read: what can be selected, what a range covers, and what a batch acts on.

const pr = (n: number, repo = "acme/api"): AnyItem => ({
  kind: "pr",
  number: n,
  title: `pull request ${n}`,
  repo,
  url: `https://github.com/${repo}/pull/${n}`,
  health: "none",
  age: "2d",
  ts: n,
  unresolved: 0,
  conversation: 0,
})

const task = (key: string): AnyItem =>
  ({
    kind: "task",
    key,
    summary: `${key} summary`,
    url: `https://tracker.example/${key}`,
    status: "In Development",
    age: "",
  }) as AnyItem

const fence = (repo: string): AnyItem =>
  ({ kind: "repo-header", repo, age: "" }) as AnyItem

describe("isSelectable", () => {
  it("takes work rows and refuses furniture", () => {
    expect(isSelectable(pr(1))).toBe(true)
    expect(isSelectable(task("SHOP-1"))).toBe(true)
    expect(isSelectable(fence("acme/api"))).toBe(false)
    expect(isSelectable(undefined)).toBe(false)
  })
})

describe("rangeKeys", () => {
  const items = [pr(1), fence("acme/web"), pr(2, "acme/web"), pr(3, "acme/web")]

  it("covers both ends and skips a header between them", () => {
    expect(rangeKeys(items, 0, 3, rowKey)).toEqual([
      "acme/api/1",
      "acme/web/2",
      "acme/web/3",
    ])
  })

  it("reads the same whichever way the range was swept", () => {
    expect(rangeKeys(items, 3, 0, rowKey)).toEqual(
      rangeKeys(items, 0, 3, rowKey),
    )
  })

  it("clamps an index past the end rather than reading undefined", () => {
    expect(rangeKeys(items, 2, 99, rowKey)).toEqual([
      "acme/web/2",
      "acme/web/3",
    ])
  })
})

describe("selectedRows", () => {
  it("returns rows in list order, not the order they were picked", () => {
    const items = [pr(1), pr(2), pr(3)]
    const keys = new Set(["acme/api/3", "acme/api/1"])
    expect(selectedRows(items, keys, rowKey).map(rowKey)).toEqual([
      "acme/api/1",
      "acme/api/3",
    ])
  })

  // The count and the batch both come from here, over the drawn list: a key
  // whose row a filter hid or a refresh removed simply finds nothing.
  it("drops keys with no row on screen", () => {
    const keys = new Set(["acme/api/1", "acme/api/9"])
    expect(selectedRows([pr(1), pr(2)], keys, rowKey)).toHaveLength(1)
  })
})

describe("selectedUrls", () => {
  it("de-duplicates a row drawn twice", () => {
    const one = task("SHOP-1")
    expect(selectedUrls([one, pr(1), one])).toEqual([
      "https://tracker.example/SHOP-1",
      "https://github.com/acme/api/pull/1",
    ])
  })
})

describe("selectionGutter", () => {
  it("keeps the cursor in column 0 and the dot in column 1", () => {
    expect(selectionGutter(true, true)).toBe("❯●")
    expect(selectionGutter(true, false)).toBe("❯ ")
    expect(selectionGutter(false, true)).toBe(" ●")
    expect(selectionGutter(false, false)).toBe("  ")
  })
})

describe("rowBackground", () => {
  it("gives the cursor its own wash, selected or not", () => {
    expect(rowBackground(true, true, false)).toBe(SELECTION_BG)
    expect(rowBackground(true, false, false)).toBe(SELECTION_BG)
  })

  it("gives a selected row a quieter wash than the cursor's", () => {
    expect(rowBackground(false, true, false)).toBe(MULTI_SELECT_BG)
    expect(MULTI_SELECT_BG).not.toBe(SELECTION_BG)
    expect(rowBackground(false, false, false)).toBeUndefined()
  })

  it("washes nothing under a backdrop", () => {
    expect(rowBackground(true, true, true)).toBeUndefined()
    expect(rowBackground(false, true, true)).toBeUndefined()
  })
})
