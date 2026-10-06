import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { colors } from "@kud/ink-ui"
import {
  FocusSlotLine,
  FOCUS_MARK,
  focusCellFor,
  focusRefColor,
  type FocusSlot,
} from "./focus-slot.js"

/*
 * The slot is one fixed-height line in three states — loading, ready, empty —
 * and a gutter mark the list rows wear. Colour lives in `focusRefColor`, which
 * is why it is tested as a pure function: the frame carries no escape codes,
 * so a tint is unobservable there and a state that lived only in one would be
 * a state nobody can test for. Everything else is asserted on the glyphs and
 * words the frame shows.
 */

class FakeStdout extends EventEmitter {
  frames: string[] = []
  constructor(
    public columns: number,
    public rows = 30,
  ) {
    super()
  }
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.at(-1) ?? ""
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

const frameOf = (node: React.ReactNode): string => {
  const stdout = new FakeStdout(120)
  const instance = render(node, {
    stdout: stdout as never,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })
  const out = stdout.lastFrame().replace(ANSI, "")
  instance.unmount()
  instance.cleanup()
  return out
}

const ticketFocus = (): FocusSlot => ({
  label: "focus",
  ref: "SHOP-1234",
  title: "Payout totals double-count reversed adjustments",
  reason: "in progress · #418: 2 threads want you",
  marker: "▲",
  target: { tab: "review", url: "https://example.com/SHOP-1234" },
})

describe("focusRefColor", () => {
  it("paints a ticket key in the ticket colour", () => {
    expect(focusRefColor({ ref: "SHOP-1234" })).toBe(colors.ticket)
  })

  it("paints a PR-style ref in the accent", () => {
    expect(focusRefColor({ ref: "#427" })).toBe(colors.accent)
  })

  it("lets an explicit refColor win over both", () => {
    expect(
      focusRefColor({ ref: "SHOP-1234", refColor: colors.info }),
    ).toBe(colors.info)
    expect(focusRefColor({ ref: "#427", refColor: colors.info })).toBe(
      colors.info,
    )
  })
})

describe("focusCellFor", () => {
  const focus = ticketFocus()

  it("draws nothing without a focus", () => {
    expect(focusCellFor(undefined, focus.target.url)).toBeUndefined()
  })

  it("holds two blanks on every row but the match", () => {
    expect(focusCellFor(null, focus.target.url)).toBeNull()
    expect(focusCellFor(focus, "https://example.com/other")).toBeNull()
    expect(focusCellFor(focus, undefined)).toBeNull()
  })

  it("marks the row g would land on", () => {
    expect(focusCellFor(focus, focus.target.url)).toEqual({
      mark: FOCUS_MARK,
      color: colors.accent,
    })
  })

  it("carries a host mark and its colour through", () => {
    const custom = { ...focus, mark: "◎", markColor: colors.info }
    expect(focusCellFor(custom, custom.target.url)).toEqual({
      mark: "◎",
      color: colors.info,
    })
  })
})

describe("FocusSlotLine", () => {
  it("reads loading while the first answer is out", () => {
    const out = frameOf(<FocusSlotLine focus={undefined} width={116} />)
    expect(out).toContain("· focus  loading…")
  })

  it("reads the ticket slot in order: mark, label, marker, ref, title, reason", () => {
    const out = frameOf(<FocusSlotLine focus={ticketFocus()} width={116} />)
    expect(out).toContain(FOCUS_MARK)
    expect(out).toMatch(/focus {2}▲ SHOP-1234 {2}Payout totals.*in progress/)
  })

  it("draws a PR-style ref the same way, word for word", () => {
    const out = frameOf(
      <FocusSlotLine
        focus={{
          ...ticketFocus(),
          ref: "#427",
          title: "Fix the checkout race",
          reason: "ci failing",
        }}
        width={116}
      />,
    )
    expect(out).toMatch(/focus {2}▲ #427 {2}Fix the checkout race {3}ci failing/)
  })

  it("draws the empty sentence dim after the label when focus is null", () => {
    const out = frameOf(
      <FocusSlotLine focus={null} empty="nothing flagged" width={116} />,
    )
    expect(out).toContain(FOCUS_MARK)
    expect(out).toContain("focus  nothing flagged")
  })

  // The contract the tab strip depends on: loading, ready and empty all spend
  // exactly one content row plus the margin, so switching states never moves
  // the tabs.
  it("spends the same height in every state", () => {
    const heights = [
      frameOf(<FocusSlotLine focus={undefined} width={116} />),
      frameOf(<FocusSlotLine focus={ticketFocus()} width={116} />),
      frameOf(<FocusSlotLine focus={null} width={116} />),
    ].map((f) => f.split("\n").length)
    expect(new Set(heights).size).toBe(1)
  })

  // Like the PR rows: a row wider than its container folds the whole frame, so
  // a long title gives way rather than overflowing — middle-elided, one line.
  it("truncates a long title to stay one line", () => {
    const out = frameOf(
      <FocusSlotLine
        focus={{
          ...ticketFocus(),
          title: `a very long title ${"x".repeat(200)}`,
        }}
        width={60}
      />,
    )
    const lines = out.split("\n").filter((l) => l.includes("SHOP-1234"))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain("…")
  })
})
