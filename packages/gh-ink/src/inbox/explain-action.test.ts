import { describe, expect, it } from "vitest"
import { explainGhAction } from "./inbox.js"

// `✗ Unsubscribe failed` is not a message, it is a shrug. The one time it
// mattered the reason was a spent GraphQL quota — recoverable, and twenty
// minutes away — and the flash had thrown it on the floor.

describe("explainGhAction", () => {
  it("names a rate limit, which is the recoverable one", () => {
    const out = explainGhAction({
      stderr: "gh: API rate limit already exceeded for user ID 655838.",
    })
    expect(out).toMatch(/rate limit spent/i)
  })

  it("keeps the raw line, so an unmapped failure stays diagnosable", () => {
    const raw = "gh: something nobody has seen before"
    expect(explainGhAction({ stderr: raw })).toContain(raw)
  })

  it("reads the LAST stderr line, where gh puts its diagnosis", () => {
    expect(
      explainGhAction({ stderr: "POST /graphql\nrequest echo\ngh: HTTP 502" }),
    ).toMatch(/5xx/)
  })

  it("falls back to the thrown message when there is no stderr", () => {
    expect(explainGhAction({ message: "spawn ENOENT" })).toContain("spawn ENOENT")
  })

  // Never an empty string: "✗ #3713: " with nothing after it reads as a second bug.
  it("always says something", () => {
    for (const e of [{}, { stderr: "" }, { stderr: "   \n\n" }])
      expect(explainGhAction(e).trim().length).toBeGreaterThan(0)
  })
})
