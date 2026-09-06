import { describe, it, expect } from "vitest"
import {
  tabMarker,
  PULSE_SETTLE_MS,
  PULSE_SETTLED_FRAME,
  MERGED_FRAME_MS,
  TRANSIT_HOLD_MS,
  MERGED_HOLD_MS,
  LEAVING_HOLD_MS,
} from "./inbox.js"

/*
 * The tab pulse is the one animation in this file with no timer of its own: it
 * is gated on `markedTabs`, and a mark on a tab nobody has opened never expires
 * on purpose. Moving the marker to the tab bar widened the gate from "rows this
 * tab draws" to "any marked tab" and left that half unbounded, so one
 * uncollected mark re-rendered the whole inbox 6.7 times a second for as long as
 * the process was up. Measured 2026-09-06: 22 hours of it reached 4.15 GB and
 * was still climbing 1.4 GB/min.
 *
 * PULSE_SETTLE_MS bounds the TICKER without touching the MARK. These pin the two
 * ways that fix could quietly break the feature it protects.
 */

const PULSE_MAX_FRAMES = Math.ceil(PULSE_SETTLE_MS / MERGED_FRAME_MS)

describe("tab pulse ceiling", () => {
  it("settles on a glyph you can still see", () => {
    // The failure this guards is the fix undoing the feature: five of the six
    // pulse frames are narrower than the widest, and one is a bare dot that
    // reads as no marker at all. Stopping the ticker must leave the mark
    // legible, because staying legible is the whole promise the mark makes.
    const marked = new Set(["review"])
    expect(tabMarker(marked, "review", PULSE_SETTLED_FRAME)).toBe("◉ ")
  })

  it("leaves an unmarked tab alone at the settled frame", () => {
    // The settled frame is a real frame number, so it must not turn a tab that
    // was never marked into one that looks marked.
    expect(tabMarker(new Set(["review"]), "done", PULSE_SETTLED_FRAME)).toBe(
      "  ",
    )
  })

  it("outlasts every row hold, so no row animation is cut short", () => {
    // The ceiling exists for the open-ended TAB case. Every row hold is already
    // bounded by its own timer, and the shared ticker drives their frames too —
    // so a ceiling shorter than the longest hold would freeze a sparkle
    // mid-animation. Assert the ordering rather than the numbers, so moving any
    // hold has to come back through here.
    const ceiling = PULSE_MAX_FRAMES * MERGED_FRAME_MS
    for (const hold of [TRANSIT_HOLD_MS, MERGED_HOLD_MS, LEAVING_HOLD_MS])
      expect(ceiling).toBeGreaterThan(hold)
  })

  it("runs long enough to be noticed at all", () => {
    // The other end of the same trade. A ceiling of a few frames would bound the
    // render loop perfectly and deliver no pulse, which is a silent way to
    // delete the feature.
    expect(PULSE_MAX_FRAMES).toBeGreaterThan(100)
  })
})
