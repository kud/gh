import { describe, expect, it } from "vitest"
import type { PrHealthData } from "@kud/gh"

import { joinCells, summaryOf, type Summary } from "./pr-summary.js"

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

/*
 * What the renderer will draw, in order, with the absent cells dropped — so a
 * spec about the LINE can stay a spec about the line even though the cells are
 * returned separately for their tiers.
 */
const line = (s: Summary) =>
  joinCells([s.size, s.files, s.draft, s.head, s.base, s.author, s.opened])

describe("summaryOf", () => {
  it("reads as size, files, branches, author and age", () => {
    const s = summaryOf(item, health(), WIDE)
    expect(s.size).toBe("+412 -38")
    expect(s.files).toBe("12 files")
    expect(line(s)).toBe(
      "+412 -38 · 12 files · fix/turn-arrow → main · kud · opened 3d ago",
    )
  })

  /*
   * Cells, not one string: the renderer draws the size bold in green and red,
   * the file count plain, the base plain, provenance dim. A tier cannot be
   * expressed inside a joined line, so the split has to happen here.
   */
  it("hands the file count back on its own, out of the dim run", () => {
    const s = summaryOf(item, health(), WIDE)
    expect(s.files).toBe("12 files")
    expect(s.author).not.toContain("files")
    expect(s.head).not.toContain("files")
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
   * ready to merge" on a draft is a genuine misread — so it leads. A cell of its
   * own rather than a column because it is rare, and a cell that is usually
   * empty teaches you to skip past it.
   */
  it("leads the dim run with draft, in the inbox row's own glyph", () => {
    const s = summaryOf({ ...item, health: "draft" }, health(), WIDE)
    expect(s.draft).toBe("~ draft")
    expect(line(s)).toContain("12 files · ~ draft · fix/turn-arrow")
  })

  it("says nothing about draft on an ordinary PR", () => {
    expect(summaryOf(item, health(), WIDE).draft).toBeNull()
  })

  /*
   * THE BASE IS SUPPRESSED WHEN IT IS THE DEFAULT, so the arrow's presence is
   * the signal. `→ main` on every pull request trains a reader out of looking at
   * that cell, and by the time it says `develop` they stopped weeks ago.
   */
  it("says nothing about the base when it is the repo default", () => {
    const s = summaryOf(item, health(), WIDE, "main")
    expect(s.base).toBeNull()
    expect(line(s)).toBe(
      "+412 -38 · 12 files · fix/turn-arrow · kud · opened 3d ago",
    )
  })

  it("draws the base when it is not the repo default", () => {
    const s = summaryOf(item, health({ baseRefName: "develop" }), WIDE, "main")
    expect(s.base).toBe("→ develop")
    expect(s.head).toBe("fix/turn-arrow")
  })

  /*
   * The base comes back as its own cell precisely so the renderer can lift it
   * out of the dim tier. If it were ever folded back in with the head branch,
   * presence would be firing from inside the run it needs to stand out from.
   */
  it("keeps the base apart from the head branch so they can be drawn apart", () => {
    const s = summaryOf(item, health({ baseRefName: "develop" }), WIDE, "main")
    expect(s.head).not.toContain("→")
    expect(s.head).not.toContain("develop")
  })

  /*
   * An unknown default means DRAW IT — a repo with no default branch at all
   * reports `undefined`, and so does a caller that has not fetched yet. A failed
   * lookup never arrives here as `undefined`: `fetchDefaultBranch` throws, so the
   * cache keeps its last good answer rather than flickering the cell back on.
   */
  it("draws the base when no default branch is known", () => {
    expect(summaryOf(item, health(), WIDE).base).toBe("→ main")
    expect(summaryOf(item, health(), WIDE, undefined).base).toBe("→ main")
  })

  /*
   * THE LADDER, dropping from the bottom of a ranking. It was one rung — the head
   * branch went and everything else stayed — which meant there was no step at all
   * between "fits" and "wraps", and the header's "the line never wraps" was
   * false for any terminal narrow enough. The ranking, most expendable first:
   * the author, `opened Nd ago`, the head branch, and `→ base` kept longest
   * because it is drawn only when it is notable at all.
   */
  it("drops the head branch and keeps the base when the line will not fit", () => {
    const long = {
      ...item,
      branch: "feature/an-extremely-long-branch-name-here",
    }
    const s = summaryOf(long, health(), 48)
    expect(s.base).toBe("→ main")
    expect(s.head).toBeNull()
  })

  it("gives up the author first — it is `kud` on nearly every row", () => {
    // Wide enough for everything but the author.
    const s = summaryOf(item, health(), 60)
    expect(s.author).toBeNull()
    expect(s.opened).toBe("opened 3d ago")
    expect(s.head).toBe("fix/turn-arrow")
  })

  it("gives up the age second, before the branch it took to get there", () => {
    const s = summaryOf(item, health(), 50)
    expect(s.author).toBeNull()
    expect(s.opened).toBeNull()
    expect(s.head).toBe("fix/turn-arrow")
  })

  /*
   * The floor. Below this the line cannot shrink further without truncating a
   * number, which it never does — but it must still be ONE line, and it is:
   * everything elastic is gone and what remains is fixed-width by construction.
   */
  it("keeps the base standing when everything elastic has gone", () => {
    const s = summaryOf(item, health({ baseRefName: "develop" }), 10, "main")
    expect(s.base).toBe("→ develop")
    expect(s.head).toBeNull()
    expect(s.author).toBeNull()
    expect(s.opened).toBeNull()
  })

  /*
   * The bug this ladder exists to fix: with one rung, a line whose remainder
   * still exceeded `cols` had nowhere left to go and wrapped. Nothing narrower
   * than the fixed cells may now exceed its own budget by an elastic cell.
   */
  it("never leaves an elastic cell standing over budget", () => {
    for (const cols of [20, 30, 40, 50, 60, 70, 80]) {
      const s = summaryOf(item, health({ baseRefName: "develop" }), cols, "main")
      const elastic = [s.head, s.author, s.opened].filter(Boolean).length
      if (line(s).length > cols) expect(elastic).toBe(0)
    }
  })

  it("never truncates the numbers to make room", () => {
    expect(summaryOf(item, health(), 20).size).toBe("+412 -38")
  })

  it("draws nothing about size while the fetch is still in flight", () => {
    // The line is rendered from whatever is known; an unanswered fetch means no
    // size rather than a placeholder claiming zero.
    const s = summaryOf(item, null, WIDE)
    expect(s.size).toBeNull()
    expect(line(s)).toBe("fix/turn-arrow · kud · opened 3d ago")
  })

  it("survives a PR with no branch recorded", () => {
    const s = summaryOf({ ...item, branch: undefined }, health(), WIDE)
    expect(s.head).toBeNull()
    expect(s.base).toBe("→ main")
  })

  /*
   * The bare space between head and base belongs to the PAIR, not to the base.
   * With no head branch the base follows the file count, and a space there would
   * glue the arrow onto the wrong fact — `12 files → main`.
   */
  it("keeps a full divider before the base when no head branch precedes it", () => {
    const s = summaryOf({ ...item, branch: undefined }, health(), WIDE)
    expect(line(s)).toBe("+412 -38 · 12 files · → main · kud · opened 3d ago")
  })

  it("joins head and base with the arrow alone, not a divider", () => {
    const s = summaryOf(item, health({ baseRefName: "develop" }), WIDE, "main")
    expect(line(s)).toContain("fix/turn-arrow → develop · kud")
  })
})
