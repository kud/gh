import { describe, expect, it } from "vitest"
import { repeatedTaskRows, type AnyItem, type TaskRow } from "./inbox.js"

// A ticket whose PRs straddle two bands appears in both, which is correct: the
// band reads each PR, not the ticket. Drawn identically twice it read as TWO
// tickets, so the second occurrence keeps its key and drops its summary.

const task = (key: string, summary: string, url: string): TaskRow => ({
  kind: "task",
  key,
  summary,
  url,
  status: "In Development",
  age: "",
  indent: false,
})

const JIRA = "https://jira/ACC-1"

describe("repeatedTaskRows", () => {
  it("marks the second appearance of the same ticket, never the first", () => {
    const rows: AnyItem[] = [task("ACC-1", "Provision", JIRA), task("ACC-1", "Provision", JIRA)]
    expect([...repeatedTaskRows(rows)]).toEqual([1])
  })

  it("marks every appearance after the first", () => {
    const rows: AnyItem[] = [
      task("ACC-1", "Provision", JIRA),
      task("ACC-1", "Provision", JIRA),
      task("ACC-1", "Provision", JIRA),
    ]
    expect([...repeatedTaskRows(rows)]).toEqual([1, 2])
  })

  it("leaves a genuinely different ticket alone", () => {
    const rows: AnyItem[] = [
      task("ACC-1", "Provision", JIRA),
      task("ACC-2", "Stand up", "https://jira/ACC-2"),
    ]
    expect([...repeatedTaskRows(rows)]).toEqual([])
  })

  // The regression this cost once, caught by transit.test.tsx: `life` heads
  // several unrelated rows with one category label, and keying on `key` flattened
  // every summary but the first.
  it("leaves rows that merely SHARE A LABEL alone", () => {
    const rows: AnyItem[] = [
      task("Flat", "book the plumber", "https://todo/1"),
      task("Flat", "chase the landlord", "https://todo/2"),
    ]
    expect([...repeatedTaskRows(rows)]).toEqual([])
  })

  it("never marks a row with no url, since nothing identifies it", () => {
    const rows: AnyItem[] = [
      { ...task("X", "one", ""), url: "" },
      { ...task("X", "two", ""), url: "" },
    ]
    expect([...repeatedTaskRows(rows)]).toEqual([])
  })

  // Indexes are into the WHOLE list, so intervening rows must not shift them —
  // the renderer looks up `viewStart + i` against exactly this set.
  it("indexes against the full list, headers included", () => {
    const rows: AnyItem[] = [
      { kind: "subgroup-header", label: "Needs you", indent: false } as AnyItem,
      task("ACC-1", "Provision", JIRA),
      { kind: "subgroup-header", label: "In review", indent: false } as AnyItem,
      task("ACC-1", "Provision", JIRA),
    ]
    expect([...repeatedTaskRows(rows)]).toEqual([3])
  })
})
