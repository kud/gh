import { describe, it, expect } from "vitest"
import {
  rampFrame,
  MERGED_FRAME_MS,
  TRANSIT_HOLD_MS,
  LEAVING_HOLD_MS,
} from "./inbox.js"

/*
 * A row ramp is a GOODBYE, and a goodbye happens once.
 *
 * The out ramp is a sawtooth — ◉◎○· and then straight back to ◉ — and it used to
 * be indexed with `%` off the shared ticker, so it looped for the whole hold: at
 * 7s it played the dissolve about four times over. That is what "the animation
 * feels too slow" turned out to mean. Not the tempo — the lack of an ending.
 *
 * These pin the two halves of the fix: it plays once from THIS row's own origin,
 * and it stops on the last frame rather than restarting.
 */

// The ramps are four frames; the arrays themselves live private to the module.
const LEN = 4
const FRAME_MS = MERGED_FRAME_MS * 2

describe("rampFrame", () => {
  it("starts at the first frame", () => {
    expect(rampFrame(LEN, 0, 1_000, 1_000)).toBe(0)
  })

  it("advances one frame per transit tick", () => {
    for (let i = 0; i < LEN; i++)
      expect(rampFrame(LEN, 0, 1_000, 1_000 + i * FRAME_MS)).toBe(i)
  })

  it("holds on the last frame instead of snapping back", () => {
    // The whole point. At `LEN * FRAME_MS` a modulo would return 0 — the first
    // frame again, which on the out ramp is the FULLEST glyph, so a row that had
    // just dissolved to nothing would pop back to solid.
    const justPast = 1_000 + LEN * FRAME_MS
    expect(rampFrame(LEN, 0, 1_000, justPast)).toBe(LEN - 1)
  })

  it("is still resting on the last frame at the end of the longest hold", () => {
    // A departure has to stay dissolved for the whole hold, not just past the
    // end of its ramp. Asserted against the real holds so that lengthening one
    // has to come back through here.
    for (const hold of [TRANSIT_HOLD_MS, LEAVING_HOLD_MS])
      expect(rampFrame(LEN, 0, 1_000, 1_000 + hold)).toBe(LEN - 1)
  })

  it("gives two rows that began at different moments different frames", () => {
    // The reason this counts off wall time rather than the shared ticker. Both
    // rows are drawn in the same render, so anything derived from the counter
    // alone would put them in identical phase however far apart they started.
    const now = 10_000
    const early = rampFrame(LEN, 0, now - 3 * FRAME_MS, now)
    const late = rampFrame(LEN, 0, now, now)
    expect(early).toBe(3)
    expect(late).toBe(0)
  })

  it("never returns a negative frame for an origin in the future", () => {
    // A clock that stepped backwards mid-hold would otherwise index off the
    // front of the array and draw `undefined` into the glyph cell.
    expect(rampFrame(LEN, 0, 2_000, 1_000)).toBe(0)
  })

  it("falls back to the looping counter when no origin was recorded", () => {
    // Not to frame zero: `now - 0` clamps to the last frame, so a row whose
    // origin went missing would render as an animation that had already ended
    // rather than as one that visibly never ran.
    expect(rampFrame(LEN, 5)).toBe(1)
    expect(rampFrame(LEN, 4)).toBe(0)
  })
})
