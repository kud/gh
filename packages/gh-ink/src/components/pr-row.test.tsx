import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import type { GHItem } from "@kud/gh-workflow"
import { PrRow } from "./pr-row.js"

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
})
