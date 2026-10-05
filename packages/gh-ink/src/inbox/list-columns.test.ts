import { describe, expect, it } from "vitest"
import { listColumnsOf } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

// The number cell and the trailing columns are measured over every tab at
// once. Measured per tab, a tab holding #1234 and one holding #157 put their
// titles a column apart, and the list shifted sideways on every switch.

const pr = (number: number, age: string): GHItem => ({
  kind: "pr",
  number,
  title: "a row",
  repo: "acme/widget-store",
  url: `https://github.com/acme/widget-store/pull/${number}`,
  health: "none",
  age,
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const section = (id: string, items: GHItem[]): Section =>
  ({ id, label: id, items }) as Section

describe("listColumnsOf", () => {
  it("gives two tabs with different number widths the same columns", () => {
    const wide = section("assigned", [pr(1234, "12d")])
    const narrow = section("issues", [pr(157, "3h")])
    const both = [wide, narrow]
    expect(listColumnsOf(both).numberCols).toBe(
      listColumnsOf([wide]).numberCols,
    )
    expect(listColumnsOf(both).numberCols).toBeGreaterThan(
      listColumnsOf([narrow]).numberCols,
    )
    expect(listColumnsOf(both).trailingColumns).toEqual(
      listColumnsOf([wide]).trailingColumns,
    )
  })
})
