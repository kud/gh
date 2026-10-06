import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import { FOCUS_MARK, type FocusSlot } from "./focus-slot.js"
import type { GHItem, Section, TaskRow } from "./inbox.js"

/*
 * The focus slot and its `g` jump, through the real App: the reserved row in
 * each state, the gutter mark on the one matching row, the jump across tabs
 * (including out of a collapsed tail), the tab icons beside the labels, and
 * the proof that a host without the feature draws what it always drew.
 *
 * Mounted over ink's own render with a sized stdout, the way tab-groups does
 * it — the slot and the gutter are layout, so they need a frame, not a unit.
 */

const pr = (number: number): GHItem => ({
  kind: "pr",
  number,
  title: `pull request number ${number}`,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const task = (key = "SHOP-1234"): TaskRow => ({
  kind: "task",
  key,
  ticket: key,
  summary: "Payout totals double-count reversed adjustments",
  url: `https://example.com/${key}`,
  status: "In progress",
  age: "2d",
})

const ticketFocus = (): FocusSlot => ({
  label: "focus",
  ref: "SHOP-1234",
  title: "Payout totals double-count reversed adjustments",
  reason: "in progress · #418: 2 threads want you",
  marker: "▲",
  target: { tab: "review", url: "https://example.com/SHOP-1234" },
})

class FakeStdout extends EventEmitter {
  frames: string[] = []
  constructor(
    public columns: number,
    public rows: number,
  ) {
    super()
  }
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.at(-1) ?? ""
}

class FakeStdin extends EventEmitter {
  isTTY = true
  private buffer: string | null = null
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => {
    const data = this.buffer
    this.buffer = null
    return data
  }
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

const mount = async (node: React.ReactNode) => {
  // Tall enough for the whole `?` legend to fit unpaginated: the jump row sits
  // near the end of the key column, and a paged legend would need a scroll
  // before it could be asserted.
  const stdout = new FakeStdout(120, 60)
  const stdin = new FakeStdin()
  const instance = render(node, {
    stdout: stdout as never,
    stdin: stdin as never,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })
  await settle()
  await settle()
  const press = async (k: string) => {
    stdin.press(k)
    await settle()
    await settle()
    await new Promise((r) => setTimeout(r, 20))
    await settle()
  }
  return {
    press,
    frame: () => stdout.lastFrame().replace(ANSI, ""),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

const browse = (
  sections: Section[],
  extra?: {
    focus?: FocusSlot | null
    focusLabel?: string
    focusEmpty?: string
  },
) =>
  mount(
    <App
      fetcher={async () => ({ sections, login: "kud", ...extra })}
      focusLabel={extra?.focusLabel}
      focusEmpty={extra?.focusEmpty}
    />,
  )

describe("the focus slot", () => {
  // With no focus prop anywhere, the feature is absent rather than empty: no
  // row, no gutter, nothing for `g` to do — the frame reads as it always has.
  it("draws nothing without the feature, byte for byte", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1), pr(2)] },
    ]
    const { frame, done } = await browse(sections)
    const out = frame()
    done()
    expect(out).not.toContain(FOCUS_MARK)
    expect(out).not.toContain("loading…")
    expect(out).toContain("pull request number 1")
  })

  it("reads loading while the fetch carries no focus", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1)] },
    ]
    const { frame, done } = await browse(sections, {
      focusLabel: "focus",
      focusEmpty: "nothing flagged",
    })
    const out = frame()
    done()
    expect(out).toContain("· focus  loading…")
  })

  it("reads the ready slot after the strip and above the tabs", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1)] },
    ]
    const { frame, done } = await browse(sections, {
      focus: ticketFocus(),
      focusEmpty: "nothing flagged",
    })
    const out = frame()
    done()
    // The hint's nine cells come out of the title's budget at this width, so
    // the title middle-elides where it once fit whole; the reason stays
    // complete and the key follows it. Both halves asserted: the words still
    // point, and the key still advertises the jump.
    expect(out).toMatch(
      /focus\uE0B4 {2}▲ SHOP-1234 {2}Payout totals.* {3}in progress/,
    )
    expect(out).toMatch(/ {3}g jump/)
    // Below the header, above the tab strip.
    const lines = out.split("\n")
    const slot = lines.findIndex((l) => l.includes("SHOP-1234  Payout"))
    const tabs = lines.findIndex((l) => l.includes("Open"))
    expect(slot).toBeGreaterThan(-1)
    expect(tabs).toBeGreaterThan(-1)
    expect(slot).toBeLessThan(tabs)
  })

  it("reads the empty sentence dim after the label when focus is null", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1)] },
    ]
    const { frame, done } = await browse(sections, {
      focus: null,
      focusEmpty: "nothing flagged",
    })
    const out = frame()
    done()
    expect(out).toContain("focus  nothing flagged")
  })

  // The tabs sit below the slot, so a state that spent a different height
  // would shove them on every transition between answers.
  it("holds the frame height across loading, ready and empty", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1), pr(2)] },
    ]
    const heights: number[] = []
    for (const extra of [
      { focusLabel: "focus", focusEmpty: "nothing flagged" },
      { focus: ticketFocus(), focusEmpty: "nothing flagged" },
      { focus: null, focusEmpty: "nothing flagged" },
    ] as const) {
      const { frame, done } = await browse(sections, extra)
      heights.push(frame().split("\n").length)
      done()
    }
    expect(new Set(heights).size).toBe(1)
  })

  // One mark on the whole screen: the row `g` would land on. Every other
  // url-bearing row holds two blanks so the mark moves nothing sideways.
  it("marks only the row the focus points at", async () => {
    const focus = ticketFocus()
    const sections: Section[] = [
      {
        id: "review",
        label: "Review",
        items: [task(), task("SHOP-1235"), pr(7)],
      },
    ]
    const { frame, done } = await browse(
      [{ ...sections[0]!, id: "open", label: "Open" }],
      { focus: { ...focus, target: { tab: "open", url: task().url } } },
    )
    const out = frame()
    done()
    // The slot row carries the mark too, inside its pill — what is pinned here
    // is that exactly one LIST row does, the one `g` would land on. The pill
    // row is dropped by the label glued to the pill's right cap, where the
    // old mark-and-label run was dropped by the label and two spaces.
    const marked = out.split("\n").filter((l) => l.includes(FOCUS_MARK))
    const rows = marked.filter((l) => !l.includes("focus\uE0B4"))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain("SHOP-1234")
  })

  it("marks a PR row the same way", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1), pr(2)] },
    ]
    const { frame, done } = await browse(sections, {
      focus: {
        ...ticketFocus(),
        ref: "#2",
        title: "pull request number 2",
        reason: "ci failing",
        target: { tab: "open", url: pr(2).url },
      },
    })
    const out = frame()
    done()
    const marked = out.split("\n").filter((l) => l.includes(FOCUS_MARK))
    const rows = marked.filter((l) => !l.includes("focus\uE0B4"))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain("#2")
  })
})

describe("g jumps to the focus", () => {
  const sections: Section[] = [
    { id: "open", label: "Open", items: [pr(1), pr(2)] },
    { id: "review", label: "Review", items: [task(), pr(3)] },
  ]

  it("switches tab and lands the cursor on the row", async () => {
    const { press, frame, done } = await browse(sections, {
      focus: ticketFocus(),
      focusEmpty: "nothing flagged",
    })
    expect(frame()).toContain("pull request number 1")
    await press("g")
    const out = frame()
    done()
    // Off the first tab entirely, standing on the ticket.
    expect(out).not.toContain("pull request number 1")
    expect(out).toMatch(/❯.*SHOP-1234/)
  })

  // A collapsed tail IS the rest of the tree, so the jump opens the tail its
  // row is folded into rather than reporting the row missing.
  it("expands a collapsed tail hiding the row", async () => {
    const hidden = [pr(4)]
    const folded: Section[] = [
      { id: "open", label: "Open", items: [pr(1)] },
      {
        id: "review",
        label: "Review",
        items: [pr(3), { kind: "show-more", hidden, depth: 0 }],
      },
    ]
    const { press, frame, done } = await browse(folded, {
      focus: {
        ...ticketFocus(),
        target: { tab: "review", url: pr(4).url },
      },
      focusEmpty: "nothing flagged",
    })
    await press("g")
    const out = frame()
    done()
    expect(out).toContain("pull request number 4")
    expect(out).toMatch(/❯.*pull request number 4/)
  })

  it("does nothing when focus is null or unwired", async () => {
    for (const extra of [
      { focus: null, focusEmpty: "nothing flagged" },
      {},
    ] as const) {
      const { press, frame, done } = await browse(sections, extra)
      await press("g")
      const out = frame()
      done()
      expect(out).toContain("pull request number 1")
      expect(out).not.toContain("SHOP-1234  Payout")
    }
  })

  it("names g in the legend only while a focus is on screen", async () => {
    const withFocus = await browse(sections, {
      focus: ticketFocus(),
      focusEmpty: "nothing flagged",
    })
    await withFocus.press("?")
    expect(withFocus.frame()).toContain("jump to focus")
    withFocus.done()

    const without = await browse(sections)
    await without.press("?")
    const legend = without.frame()
    without.done()
    expect(legend).toContain("Legend")
    expect(legend).not.toContain("jump to focus")
  })
})

describe("tab icons", () => {
  it("passes section icons through to the tab strip", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", icon: "◆", items: [pr(1)] },
      { id: "review", label: "Review", items: [pr(2)] },
    ]
    const { frame, done } = await browse(sections)
    const out = frame()
    done()
    const tabLine = out.split("\n").find((l) => l.includes("Review")) ?? ""
    expect(tabLine).toContain("◆")
    expect(tabLine).toContain("Open")
  })

  it("draws no icon column without any icons", async () => {
    const sections: Section[] = [
      { id: "open", label: "Open", items: [pr(1)] },
      { id: "review", label: "Review", items: [pr(2)] },
    ]
    const { frame, done } = await browse(sections)
    const out = frame()
    done()
    expect(out).not.toContain("◆")
  })
})
