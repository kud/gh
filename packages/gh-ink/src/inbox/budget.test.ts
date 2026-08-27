import { describe, expect, it } from "vitest"
import { budgetNotice, type InboxBudget } from "./inbox.js"

// Priced in whole FETCHES, because that is the unit that runs out: the query
// costs ~111 points against a 5,000 pool, so "some points left" and "another
// fetch left" are different questions and only the second is actionable.

const NOW = 1_700_000_000_000
const inMins = (m: number) => new Date(NOW + m * 60_000).toISOString()

const budget = (over: Partial<InboxBudget> = {}): InboxBudget => ({
  remaining: 5000,
  cost: 111,
  resetAt: inMins(30),
  ...over,
})

describe("budgetNotice", () => {
  it("says nothing on a healthy account", () => {
    expect(budgetNotice(budget(), NOW)).toBeNull()
  })

  it("warns once the remaining fetches are countable", () => {
    // 111 * 8 = 888, so 800 is 7 fetches — under the threshold.
    expect(budgetNotice(budget({ remaining: 800 }), NOW)?.label).toContain("7 fetches left")
  })

  it("is not critical while a fetch is still affordable", () => {
    expect(budgetNotice(budget({ remaining: 800 }), NOW)?.critical).toBe(false)
  })

  it("goes critical when not one more fetch fits", () => {
    const out = budgetNotice(budget({ remaining: 50 }), NOW)
    expect(out?.critical).toBe(true)
    expect(out?.label).toMatch(/spent/)
  })

  it("says minutes on the critical notice, since waiting is the only option", () => {
    expect(budgetNotice(budget({ remaining: 0, resetAt: inMins(12) }), NOW)?.label).toContain("12m")
  })

  it("singularises one fetch", () => {
    expect(budgetNotice(budget({ remaining: 111 }), NOW)?.label).toContain("1 fetch left")
  })

  // A spent window that has already rolled is history, not a warning — and the
  // gate reads the same value, so a stale entry must not keep refresh paused.
  it("says nothing once the window has already reset", () => {
    expect(budgetNotice(budget({ remaining: 0, resetAt: inMins(-1) }), NOW)).toBeNull()
  })

  it("says nothing when the host reports no budget at all", () => {
    expect(budgetNotice(null, NOW)).toBeNull()
    expect(budgetNotice(undefined, NOW)).toBeNull()
  })

  // Guard the guard: a zero cost would divide by zero and make every account
  // look infinite, which is the failure that silently disables the whole thing.
  it("survives a zero cost rather than reporting infinity", () => {
    expect(budgetNotice(budget({ remaining: 5, cost: 0 }), NOW)?.label).toContain("5 fetches left")
  })
})
