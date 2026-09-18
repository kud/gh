import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import {
  SidePanel,
  railCapacity,
  railHeights,
  counts,
  truncateWords,
  railWidth,
  type Sidebar,
} from "./side-panel.js"

/*
 * The rail is fixed to the list's height, and Ink's answer to more rows than
 * height is to cut them — silently. That is the one failure this component
 * cannot be allowed to have: a roadmap quietly missing its last three
 * initiatives looks exactly like a roadmap that has none, and an initiative
 * being invisible is the whole reason the rail was built.
 */
const rail = (n: number): Sidebar => ({
  title: "Initiatives",
  rows: Array.from({ length: n }, (_, i) => ({
    key: `PROJ-${100 + i}`,
    label: `initiative number ${i}`,
    live: i,
  })),
})

const frameOf = (node: React.ReactElement) => render(node).lastFrame() ?? ""

describe("counts", () => {
  it("says how far through, then how much is moving", () => {
    expect(counts({ key: "P-1", label: "x", done: 4, total: 9, live: 1 })).toBe(
      "4/9 · 1 live",
    )
  })

  // A numerator with no denominator is not progress, it is a number.
  it("refuses to draw half a fraction", () => {
    expect(counts({ key: "P-1", label: "x", done: 4, live: 1 })).toBe("1 live")
    expect(counts({ key: "P-1", label: "x", total: 9, live: 1 })).toBe("1 live")
  })

  // The pair can be unknown while `live` is known: `live` is what the board
  // already drew, and progress needs asking Jira a second time.
  it("says what it does know when the other half is missing", () => {
    expect(counts({ key: "P-1", label: "x", live: 2 })).toBe("2 live")
    expect(counts({ key: "P-1", label: "x", done: 0, total: 3 })).toBe("0/3")
  })

  // An initiative that is 4/9 with nothing moving is the one you most want to
  // notice, so a counted zero is printed rather than folded away.
  it("prints a zero it actually counted", () => {
    expect(counts({ key: "P-1", label: "x", done: 4, total: 9, live: 0 })).toBe(
      "4/9 · nothing live",
    )
  })

  it("says nothing at all when nothing was counted", () => {
    expect(counts({ key: "P-1", label: "x" })).toBe("")
  })
})

describe("railCapacity", () => {
  it("takes every row when they all fit", () => {
    // 2 heading lines + 3 rows × 3 lines
    expect(railCapacity(11, 3)).toBe(3)
  })

  // One fewer than physically fits, to buy the line that says how many are left.
  it("gives up a row to pay for the overflow count", () => {
    expect(railCapacity(11, 9)).toBe(2)
  })

  it("never returns a negative count on a rail with no room at all", () => {
    expect(railCapacity(1, 9)).toBe(0)
    expect(railCapacity(0, 9)).toBe(0)
  })
})

describe("SidePanel", () => {
  it("draws every row when the height allows", () => {
    const frame = frameOf(<SidePanel sidebar={rail(3)} height={11} />)
    for (const key of ["PROJ-100", "PROJ-101", "PROJ-102"])
      expect(frame).toContain(key)
    expect(frame).not.toContain("more")
  })

  it("says how many it could not draw", () => {
    const frame = frameOf(<SidePanel sidebar={rail(9)} height={11} />)
    expect(frame).toContain("PROJ-100")
    expect(frame).toContain("+7 more")
  })

  // An unconstrained rail has no reason to hold anything back.
  it("draws everything when given no height", () => {
    const frame = frameOf(<SidePanel sidebar={rail(9)} />)
    expect(frame).toContain("PROJ-108")
    expect(frame).not.toContain("more")
  })

  // "Nothing open" and "we could not tell you" are different claims, and an
  // empty rail with no words is indistinguishable from a broken one.
  it("says so when there is nothing to show", () => {
    expect(
      frameOf(<SidePanel sidebar={{ title: "Initiatives", rows: [] }} />),
    ).toContain("nothing open")
  })
})

describe("the live cell", () => {
  it("takes the host's words, with the number handed in", () => {
    const onBoard = (n: number) => (n === 0 ? "off board" : `${n} on board`)
    expect(
      counts({ key: "P-1", label: "x", done: 1, total: 3, live: 4 }, onBoard),
    ).toBe("1/3 · 4 on board")
    expect(counts({ key: "P-1", label: "x", live: 0 }, onBoard)).toBe(
      "off board",
    )
  })

  it("draws the host's words on the rail", () => {
    const frame = frameOf(
      <SidePanel
        liveLabel={(n) => (n === 0 ? "off board" : `${n} on board`)}
        sidebar={{
          title: "Initiatives",
          rows: [
            { key: "P-1", label: "moving", live: 2, done: 1, total: 4 },
            { key: "P-2", label: "quiet", live: 0, done: 0, total: 9 },
          ],
        }}
      />,
    )
    expect(frame).toContain("2 on board")
    expect(frame).toContain("off board")
    expect(frame).toContain("1/4")
    expect(frame).toContain("0/9")
  })
})

describe("truncateWords", () => {
  it("leaves a label that fits alone", () => {
    expect(truncateWords("Automate the accounting run", 45)).toBe(
      "Automate the accounting run",
    )
  })

  // A cut mid word makes the reader finish the word before the row can be read.
  it("cuts at a word boundary and says so", () => {
    expect(
      truncateWords(
        "Cloudsearch → OpenSearch migration: frontend-royalties & frontend-contract",
        45,
      ),
    ).toBe("Cloudsearch → OpenSearch migration…")
  })

  // `batch (…` reads as a typo where `batch…` reads as a cut.
  it("drops the punctuation a boundary cut leaves dangling", () => {
    expect(
      truncateWords("Transfer of Earnings adjustments batch (Abacus)", 40),
    ).toBe("Transfer of Earnings adjustments batch…")
    expect(
      truncateWords("Product analytics — Segment event tracking, funnels", 44),
    ).toBe("Product analytics — Segment event tracking…")
  })

  // Honouring the boundary must not surrender half the line to a space.
  it("falls back to a character cut when the boundary is too early", () => {
    expect(truncateWords("https://example.com/a/very/long/path x", 20)).toBe(
      "https://example.com…",
    )
  })
})

describe("the row anatomy", () => {
  const two: Sidebar = {
    title: "Initiatives",
    rows: [
      { key: "PROJ-1", label: "wants you", live: 1, wantsYou: true },
      { key: "PROJ-2", label: "under the cursor", live: 0 },
    ],
  }

  // Label first: a roadmap is read by name, and the key is what you open.
  it("puts the label above its key", () => {
    const lines = frameOf(<SidePanel sidebar={two} />).split("\n")
    const label = lines.findIndex((l) => l.includes("wants you"))
    expect(lines[label + 1]).toContain("PROJ-1")
  })

  // Two marks in two cells: `←` is what wants you, `❯` is where you are, and a
  // row can be both without either hiding the other.
  it("keeps the arrow and the cursor in their own cells", () => {
    const frame = frameOf(<SidePanel sidebar={two} focused cursor={1} />)
    expect(frame).toMatch(/  ← wants you/)
    expect(frame).toMatch(/❯   under the cursor/)
    const both = frameOf(
      <SidePanel
        sidebar={{ ...two, rows: [two.rows[0]!] }}
        focused
        cursor={0}
      />,
    )
    expect(both).toMatch(/❯ ← wants you/)
  })

  it("names the focus in a word, not only a hue", () => {
    expect(frameOf(<SidePanel sidebar={two} focused />)).toContain("● focus")
    expect(frameOf(<SidePanel sidebar={two} />)).not.toContain("● focus")
  })
})

describe("railWidth", () => {
  // A third of the frame, floored at the width the grid was laid out for and
  // capped where a label stops needing more.
  it("sizes the rail to the frame between its floor and ceiling", () => {
    expect(railWidth(120)).toBe(52)
    expect(railWidth(156)).toBe(52)
    expect(railWidth(180)).toBe(60)
    expect(railWidth(200)).toBe(64)
    expect(railWidth(300)).toBe(64)
  })

  it("gives a wider rail's columns to the label", () => {
    const long =
      "Cloudsearch → OpenSearch migration: frontend-royalties & frontend-contract"
    const row = { key: "P-1", label: long, live: 1 }
    const narrow = frameOf(
      <SidePanel sidebar={{ title: "Initiatives", rows: [row] }} width={52} />,
    )
    const wide = frameOf(
      <SidePanel sidebar={{ title: "Initiatives", rows: [row] }} width={64} />,
    )
    expect(narrow).toContain("Cloudsearch → OpenSearch migration…")
    expect(wide).toContain("migration: frontend-royalties")
  })
})

describe("the rail's marker", () => {
  it("draws the host's mark before the key, and a blank where there is none", () => {
    const frame = frameOf(
      <SidePanel
        sidebar={{
          title: "Initiatives",
          rows: [
            { key: "P-1", label: "high", marker: "⇈", live: 1 },
            { key: "P-2", label: "plain", live: 1 },
          ],
        }}
      />,
    )
    const lines = frame.split("\n")
    const marked = lines.find((l) => l.includes("P-1")) ?? ""
    const plain = lines.find((l) => l.includes("P-2")) ?? ""
    expect(marked).toMatch(/⇈ P-1/)
    expect(plain.indexOf("P-2")).toBe(marked.indexOf("P-1"))
  })
})

describe("railHeights", () => {
  // 2 sections, 20 lines, each needs 5 (2 heading + 1 row × 3). An even
  // split gives each 10, but both take only what they need.
  it("gives each section exactly what it needs when that fits inside an even share", () => {
    expect(railHeights(20, [1, 1])).toEqual([5, 5])
  })

  // The first section needs only 5 of its even share of 10, so the 5 it
  // never spent go to the second section rather than sitting blank.
  it("hands a short section's surplus down to what follows", () => {
    expect(railHeights(20, [1, 5])).toEqual([5, 15])
  })

  // The first section wants 29 lines (2 + 9 × 3) but is held to its even
  // share of 10 — it never borrows AHEAD from a section not yet drawn.
  it("caps a section at its even share rather than borrowing from what follows", () => {
    expect(railHeights(20, [9, 1])).toEqual([10, 5])
  })
})

describe("SidePanel with a stack", () => {
  const two: Sidebar[] = [
    {
      title: "Initiatives",
      rows: [
        { key: "P-1", label: "alpha", live: 1 },
        { key: "P-2", label: "beta", live: 0 },
      ],
    },
    {
      title: "Services",
      rows: [{ key: "S-1", label: "gamma", live: 1 }],
    },
  ]

  it("draws every section, each under its own heading", () => {
    const frame = frameOf(<SidePanel sidebar={two} />)
    expect(frame).toContain("Initiatives")
    expect(frame).toContain("Services")
    expect(frame).toContain("P-1")
    expect(frame).toContain("S-1")
  })

  // The cursor is ONE number counted across the whole stack: 2 lands on the
  // first row of the second section, and only that section may claim focus.
  it("counts the cursor across the stack and focuses only the section it falls in", () => {
    const frame = frameOf(<SidePanel sidebar={two} focused cursor={2} />)
    const lines = frame.split("\n")
    expect((frame.match(/● focus/g) ?? []).length).toBe(1)
    const focusLine = lines.findIndex((l) => l.includes("● focus"))
    const servicesHeading = lines.findIndex((l) => l.includes("Services"))
    const initiativesHeading = lines.findIndex((l) => l.includes("Initiatives"))
    expect(focusLine).toBe(servicesHeading)
    expect(focusLine).not.toBe(initiativesHeading)
    // The cursor mark sits on the label line itself, as it does for a single
    // rail — see "keeps the arrow and the cursor in their own cells" above.
    const gammaLine = lines.find((l) => l.includes("gamma")) ?? ""
    expect(gammaLine).toContain("❯")
    const alphaLine = lines.find((l) => l.includes("alpha")) ?? ""
    expect(alphaLine).not.toContain("❯")
  })

  it("shares the rail's height across sections via railHeights", () => {
    const frame = frameOf(<SidePanel sidebar={two} height={20} />)
    expect(frame).toContain("alpha")
    expect(frame).toContain("beta")
    expect(frame).toContain("gamma")
    expect(frame).not.toContain("more")
  })
})
