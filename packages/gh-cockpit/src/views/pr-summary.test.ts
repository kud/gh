import { describe, expect, it } from "vitest"
import type { PrHealthData } from "@kud/gh"

import { summaryOf } from "./pr-summary.js"

/*
 * The one-line answer to "what IS this pull request", under the title and above
 * the tabs. Health is the DEFAULT tab, so it had quietly become the
 * about-this-PR screen while having no idea what the PR is; this is the missing
 * half, and nothing left Health to make room for it.
 */

const health = (over: Partial<PrHealthData> = {}): PrHealthData =>
  ({
    statusCheckRollup: [],
    reviews: [],
    reviewDecision: null,
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    author: null,
    additions: 412,
    deletions: 38,
    changedFiles: 12,
    baseRefName: "main",
    ...over,
  }) as PrHealthData

const item = {
  branch: "fix/turn-arrow",
  author: "kud",
  age: "3d",
}

const WIDE = 200

describe("summaryOf", () => {
  it("reads as size, files, branches, author and age", () => {
    const { size, files, rest } = summaryOf(item, health(), WIDE)
    expect(size).toBe("+412 -38")
    expect(files).toBe("12 files")
    expect(rest).toBe("fix/turn-arrow → main · kud · opened 3d ago")
  })

  /*
   * Three cells, not one string: the renderer draws the size bold and orange,
   * the file count plain, the rest dim. A tier cannot be expressed inside a
   * joined line, so the split has to happen here.
   */
  it("hands the file count back on its own, out of the dim run", () => {
    const { files, rest } = summaryOf(item, health(), WIDE)
    expect(rest).not.toContain("files")
    expect(files).toBe("12 files")
  })

  it("says file, not files, for one", () => {
    expect(summaryOf(item, health({ changedFiles: 1 }), WIDE).files).toBe(
      "1 file",
    )
  })

  it("has no file count while the fetch is still in flight", () => {
    expect(summaryOf(item, null, WIDE).files).toBeNull()
  })

  /*
   * A draft changes the meaning of everything in Health below it — "6 passed,
   * ready to merge" on a draft is a genuine misread — so it leads. A prefix
   * rather than a column because it is rare, and a cell that is usually empty
   * teaches you to skip past it.
   */
  it("leads the dim run with draft, in the inbox row's own glyph", () => {
    const { rest } = summaryOf({ ...item, health: "draft" }, health(), WIDE)
    expect(rest.startsWith("~ draft · ")).toBe(true)
  })

  it("says nothing about draft on an ordinary PR", () => {
    expect(summaryOf(item, health(), WIDE).rest).not.toContain("draft")
  })

  /*
   * The branch pair is the only elastic element, so it is the only one that
   * gives way — and it gives way in a specific direction. Under pressure, what
   * am I merging INTO outranks what the branch is called.
   */
  it("drops the head branch and keeps the base when the line will not fit", () => {
    const long = {
      ...item,
      branch: "feature/an-extremely-long-branch-name-here",
    }
    const { rest } = summaryOf(long, health(), 48)
    expect(rest).toContain("→ main")
    expect(rest).not.toContain("feature/an-extremely-long-branch-name-here")
  })

  it("never truncates the numbers to make room", () => {
    const { size } = summaryOf(item, health(), 20)
    expect(size).toBe("+412 -38")
  })

  it("draws nothing about size while the fetch is still in flight", () => {
    // The line is rendered from whatever is known; an unanswered fetch means no
    // size rather than a placeholder claiming zero.
    const { size, rest } = summaryOf(item, null, WIDE)
    expect(size).toBeNull()
    expect(rest).toBe("fix/turn-arrow · kud · opened 3d ago")
  })

  it("survives a PR with no branch recorded", () => {
    const { rest } = summaryOf({ ...item, branch: undefined }, health(), WIDE)
    expect(rest).toContain("→ main")
  })
})
