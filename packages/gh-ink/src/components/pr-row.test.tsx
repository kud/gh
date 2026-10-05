import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import type { GHItem } from "@kud/gh-workflow"
import {
  layoutOf,
  numberColumnsOf,
  PrRow,
  sectionShedOf,
  trailingColumnsOf,
} from "./pr-row.js"

/*
 * `PrRow` is the row the inbox draws and the row any other surface with a
 * `GHItem` and a width can draw. These mount it on its own, with no App, no
 * timers and no refresh around it — which is the point of the component and so
 * the point of the file: everything the row says has to be derivable from its
 * props alone, and a test that needs the inbox to prove it would mean it isn't.
 *
 * The runner is not a TTY, so the frame carries no escape codes and a colour is
 * unobservable here. That is the accessibility rule enforcing itself: every
 * assertion below is on a glyph, a word or a width, which is what a colourblind
 * reader has too.
 */
const frameOf = (node: React.ReactElement) => render(node).lastFrame() ?? ""

const pr = (over: Partial<GHItem> = {}): GHItem => ({
  kind: "pr",
  number: 214,
  title: "retry a declined card instead of reporting a network error",
  repo: "acme/widget-store",
  url: "https://github.com/acme/widget-store/pull/214",
  health: "approved",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  ...over,
})

describe("PrRow", () => {
  it("says which PR it is, what it is called, and how it stands", () => {
    const frame = frameOf(<PrRow item={pr()} active={false} cols={120} />)
    expect(frame).toContain("#214")
    expect(frame).toContain(
      "retry a declined card instead of reporting a network error",
    )
    // The glyph, never the colour — `approved` is `✓` in health-display.ts, and
    // the glyph is the whole channel for a reader who sees no hue.
    expect(frame).toContain("✓")
  })

  it("gives each health its own shape", () => {
    expect(
      frameOf(
        <PrRow item={pr({ health: "ci-fail" })} active={false} cols={120} />,
      ),
    ).toContain("✗")
    expect(
      frameOf(
        <PrRow item={pr({ health: "conflict" })} active={false} cols={120} />,
      ),
    ).toContain("!")
  })

  // `❯` and bold together, per ink-ui's rule that no state is signalled by
  // colour alone. Only the glyph is observable in a piped frame, which is
  // exactly why the glyph has to be there.
  it("marks the row under the cursor, and only that row", () => {
    expect(frameOf(<PrRow item={pr()} active={true} cols={120} />)).toContain(
      "❯",
    )
    expect(
      frameOf(<PrRow item={pr()} active={false} cols={120} />),
    ).not.toContain("❯")
  })

  /*
   * The failure this guards is not a clipped title, it is a folded frame. Ink's
   * answer to a row wider than its container is to COMPRESS every flexible child
   * rather than clip, so one over-wide row wraps into a column of fragments and
   * takes the whole list's layout with it. The row has to do its own arithmetic
   * and give up its trailing context, which is what the ladder in `widthOf`
   * exists for.
   */
  it("elides the title rather than overflowing the columns it was given", () => {
    const cols = 46
    const item = pr({
      title:
        "replace the hand-rolled retry loop with the shared backoff helper everywhere",
    })
    const frame = frameOf(<PrRow item={item} active={false} cols={cols} />)
    for (const line of frame.split("\n"))
      expect(line.length).toBeLessThanOrEqual(cols)
    expect(frame).not.toContain(item.title)
    expect(frame).toContain("…")
  })

  // The seam. A merge sparkle, a transit ramp, a pulse — the row holds none of
  // that vocabulary and is simply told which glyph the cell wears this frame.
  it("lets the caller put its own glyph in the health cell", () => {
    const frame = frameOf(
      <PrRow
        item={pr()}
        active={false}
        cols={120}
        icon={{ glyph: "✦", color: "#A371F7" }}
      />,
    )
    expect(frame).toContain("✦")
    expect(frame).not.toContain("✓")
  })

  // The other half of the same seam: the WORD is the caller's, the pill is the
  // row's. Asserted on the word rather than the fill, for the reason at the top.
  it("draws what the caller says just happened to the row", () => {
    const frame = frameOf(
      <PrRow
        item={pr()}
        active={false}
        cols={120}
        announcements={[{ label: "merged", color: "#A371F7" }]}
      />,
    )
    expect(frame).toContain("merged")
  })
  /*
   * THE POINT OF THE TRAILING BLOCK. Measured once over the section and handed
   * to every row, the numbers land in the same columns whatever the title is
   * called — so a thread count can be found by running down one column rather
   * than by reading each line. A row with no threads draws the column blank, and
   * the size beside it still lines up with its neighbours'.
   */
  it("lines up threads, size and age across rows of one section", () => {
    const rows = [
      pr({ title: "short", unresolved: 3, additions: 84, deletions: 12 }),
      pr({
        number: 88,
        title: "a rather longer title that runs on",
        unresolved: 0,
        additions: 6,
        deletions: 1,
      }),
    ]
    const columns = trailingColumnsOf(rows)
    const [a, b] = rows.map((item) =>
      frameOf(
        <PrRow item={item} active={false} cols={100} columns={columns} />,
      ),
    )
    // Right-aligned numbers: the removal count ends in the same column.
    expect(a.indexOf("-12") + 3).toBe(b.indexOf("-1") + 2)
    // And both rows end on the date at the same edge.
    expect(a.lastIndexOf("2d")).toBe(b.lastIndexOf("2d"))
  })

  /*
   * A hole in an aligned column reads as "none". So when one row needs its size
   * cell gone to keep a readable title, the section gives the column up for
   * every row, and a row that had room draws no size either.
   */
  it("gives a trailing column up for the whole section, not one row", () => {
    const roomy = pr({ additions: 84, deletions: 12 })
    const cramped = pr({
      number: 9,
      repo: "acme/a-repository-with-a-very-long-name-indeed",
      additions: 2140,
      deletions: 388,
      labels: ["needs-review", "backend"],
    })
    const columns = trailingColumnsOf([roomy, cramped])
    // 69, not 70: the number cell is the section's `#214` plus its gutter, one
    // cell narrower than the old fixed seven, so the same pressure sits one lower.
    const numberCols = numberColumnsOf([roomy, cramped])
    const context = { cols: 69, columns, numberCols }
    const shed = sectionShedOf(
      [
        { item: roomy, prefix: "" },
        { item: cramped, prefix: "└─ " },
      ],
      context,
    )
    expect(shed.size).toBe(true)
    const frame = frameOf(
      <PrRow item={roomy} active={false} {...context} shed={shed} />,
    )
    expect(frame).not.toContain("+84")
  })

  /*
   * The number cell is as wide as the section's widest `#n` plus a two-cell
   * gutter. It was `padEnd(7)` until 2026-10-02, which left `#31805` one cell
   * from its title and would have left a six-digit number none at all.
   */
  it("sizes the number cell to the widest number in the section", () => {
    const rows = [172, 464, 31805, 2005].map((number) =>
      pr({ number, repo: "acme/api-gateway", title: `title of ${number}` }),
    )
    expect(numberColumnsOf(rows)).toBe("#31805".length + 2)
    expect(numberColumnsOf([pr({ number: 172 })])).toBe("#172".length + 2)
    expect(numberColumnsOf([pr({ number: 123456 })])).toBe(9)

    const numberCols = numberColumnsOf(rows)
    const frames = rows.map((item) =>
      frameOf(
        <PrRow item={item} active={false} cols={120} numberCols={numberCols} />,
      ),
    )
    // Every title starts on the same column, two cells past the widest number.
    const starts = frames.map((f) => f.indexOf("title of"))
    expect(new Set(starts).size).toBe(1)
    const widest = frames[2]
    expect(starts[2] - (widest.indexOf("#31805") + "#31805".length)).toBe(2)
  })

  it("never runs a number into its title when the host does not measure", () => {
    const frame = frameOf(
      <PrRow
        item={pr({ number: 123456, title: "six digits" })}
        active={false}
        cols={120}
      />,
    )
    expect(frame).toContain("#123456  six digits")
  })

  /*
   * On a needs-you tab the row answers "what must be decided" rather than
   * "what is it called": the host's one line replaces the title in the same
   * cell. An empty decision is no decision — the title draws as before rather
   * than a blank where the subject should be.
   */
  it("draws the host's decision line in place of the title when set", () => {
    const item = pr({
      title: "retry a declined card instead of reporting a network error",
      needsYou: { band: "decide", decision: "Approve the migration plan" },
    })
    const frame = frameOf(<PrRow item={item} active={false} cols={120} />)
    expect(frame).toContain("Approve the migration plan")
    expect(frame).not.toContain(
      "retry a declined card instead of reporting a network error",
    )
  })

  it("draws the title when the decision is empty or absent", () => {
    for (const needsYou of [undefined, { band: "decide" as const }]) {
      const item = pr({
        title: "retry a declined card instead of reporting a network error",
        ...(needsYou ? { needsYou } : {}),
      })
      expect(
        frameOf(<PrRow item={item} active={false} cols={120} />),
      ).toContain("retry a declined card instead of reporting a network error")
    }
    const empty = pr({
      title: "retry a declined card instead of reporting a network error",
      needsYou: { band: "decide", decision: "" },
    })
    expect(frameOf(<PrRow item={empty} active={false} cols={120} />)).toContain(
      "retry a declined card instead of reporting a network error",
    )
  })
})

describe("PrRow gutter", () => {
  // A host that draws its own cursor further left — a board hanging PRs under
  // tickets — would otherwise put two `❯` on the selected line.
  it("draws no cursor of its own when the host owns the gutter", () => {
    const frame = frameOf(
      <PrRow item={pr()} active cols={120} gutter={false} prefix="├─ " />,
    )
    expect(frame).not.toContain("❯")
    expect(frame.startsWith("├─ ")).toBe(true)
  })

  it("keeps its cursor by default", () => {
    expect(frameOf(<PrRow item={pr()} active cols={120} />)).toContain("❯")
  })

  it("hands the hidden gutter's two columns to the title", () => {
    const long = pr({ title: "x".repeat(200) })
    const withGutter = layoutOf({ item: long, cols: 80 })
    const without = layoutOf({ item: long, cols: 80, gutter: false })
    expect(without.titleMax).toBe(withGutter.titleMax + 2)
  })
})
