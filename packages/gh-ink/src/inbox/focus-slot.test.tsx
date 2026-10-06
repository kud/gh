import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { colors } from "@kud/ink-ui"
import {
  FocusSlotLine,
  FOCUS_MARK,
  FOCUS_JUMP_KEY,
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

/*
 * The jump hint is the key advertised twice — once in the keymap legend, once
 * after the reason — and both read the same constant, so the test pins the
 * constant's value the way the legend does: rename the key and the hint moves
 * with it. Budget order is title first, reason second, hint last: the hint
 * stays while the words give way, and drops only when the reason itself would
 * not fit, handing its cells back.
 */
describe("FocusSlotLine jump hint", () => {
  it("pins the jump key the legend and handler share", () => {
    expect(FOCUS_JUMP_KEY).toBe("g")
  })

  it("draws the key and the word after the reason on the ready row", () => {
    const out = frameOf(
      <FocusSlotLine focus={ticketFocus()} width={116} jumpKey={FOCUS_JUMP_KEY} />,
    )
    expect(out).toMatch(/in progress.* {3}g jump/)
  })

  it("draws nothing extra when jumpKey is unset", () => {
    const out = frameOf(<FocusSlotLine focus={ticketFocus()} width={116} />)
    expect(out).not.toContain("jump")
  })

  it("draws nothing extra for an empty key", () => {
    const out = frameOf(
      <FocusSlotLine focus={ticketFocus()} width={116} jumpKey="" />,
    )
    expect(out).not.toContain("jump")
  })

  it("stays off the loading row even when jumpKey is set", () => {
    const out = frameOf(
      <FocusSlotLine focus={undefined} width={116} jumpKey={FOCUS_JUMP_KEY} />,
    )
    expect(out).not.toContain("jump")
  })

  it("stays off the empty row even when jumpKey is set", () => {
    const out = frameOf(
      <FocusSlotLine focus={null} width={116} jumpKey={FOCUS_JUMP_KEY} />,
    )
    expect(out).not.toContain("jump")
  })

  // The frame is wider than the row budget here, so a row that honoured the
  // budget is measurable directly: one physical line, no longer than width.
  const rowOf = (out: string): string => {
    const lines = out.split("\n").filter((l) => l.includes("SHOP-1234"))
    expect(lines).toHaveLength(1)
    return lines[0]
  }

  it("keeps the reason whole and the hint while the title gives way", () => {
    const out = frameOf(
      <FocusSlotLine
        focus={{
          ...ticketFocus(),
          title: `a very long title ${"x".repeat(200)}`,
        }}
        width={100}
        jumpKey={FOCUS_JUMP_KEY}
      />,
    )
    const row = rowOf(out)
    expect([...row].length).toBeLessThanOrEqual(100)
    expect(row).toContain("…")
    expect(row).toContain(ticketFocus().reason)
    expect(row).toMatch(/ {3}g jump/)
  })

  it("truncates the reason around a hint that stays", () => {
    const out = frameOf(
      <FocusSlotLine
        focus={ticketFocus()}
        width={60}
        jumpKey={FOCUS_JUMP_KEY}
      />,
    )
    const row = rowOf(out)
    expect([...row].length).toBeLessThanOrEqual(60)
    expect(row).not.toContain(ticketFocus().reason)
    expect(row).toMatch(/ {3}g jump/)
  })

  // No room for even a one-cell reason beside the hint: the hint drops and its
  // cells go back to the reason, so the row still says why.
  it("drops the hint last, giving the space back to the reason", () => {
    const out = frameOf(
      <FocusSlotLine
        focus={ticketFocus()}
        width={35}
        jumpKey={FOCUS_JUMP_KEY}
      />,
    )
    const row = rowOf(out)
    expect([...row].length).toBeLessThanOrEqual(35)
    expect(row).not.toContain("jump")
    expect(row).toContain("…")
    expect(row.endsWith("you")).toBe(true)
  })
})
