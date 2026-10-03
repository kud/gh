import React from "react"
import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { DecisionBlock } from "./decision-block.js"

/*
 * The pinned line at the top of a drill: the host's own words on a decide
 * row, and an explicit "nothing to decide" on a merge row rather than an
 * empty heading. Mounted alone — the block is presentational, everything it
 * says is in its props, and a test needing a drill to prove it would mean it
 * is not.
 *
 * The runner is not a TTY, so the frame carries no escape codes and the
 * heading's accent is unobservable here. Assertions are on the words, which
 * is what a reader without colour has too.
 */
const frameOf = (node: React.ReactElement) => render(node).lastFrame() ?? ""

describe("DecisionBlock", () => {
  it("pins the host's decision line under a Decision heading", () => {
    const frame = frameOf(
      <DecisionBlock
        needsYou={{ band: "decide", decision: "Approve the migration plan" }}
      />,
    )
    expect(frame).toContain("Decision")
    expect(frame).toContain("Approve the migration plan")
  })

  it("says there is nothing to decide on a merge row", () => {
    const frame = frameOf(<DecisionBlock needsYou={{ band: "merge" }} />)
    expect(frame).toContain("Decision")
    expect(frame).toContain("Nothing to decide: ready to merge.")
  })
})
