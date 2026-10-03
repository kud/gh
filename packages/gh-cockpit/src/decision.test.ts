import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  decisionHooks,
  registerDecisionHooks,
} from "./decision.js"
import type { GHItem } from "./lib.js"

/*
 * The registry is module-level, like prompts and check drills — so every test
 * resets it first rather than relying on run order to leave it empty. What is
 * pinned here is the contract the drill views rely on: nothing registered
 * means answering ends at the posted comment, and whatever the host registers
 * is what gets called with the answered row.
 */

const item = { number: 42 } as unknown as GHItem

beforeEach(() => {
  registerDecisionHooks({})
})

describe("decisionHooks", () => {
  it("starts empty, so an answer ends at the posted comment", () => {
    expect(decisionHooks().answered).toBeUndefined()
  })

  it("calls what the host registered with the answered row", async () => {
    const answered = vi.fn()
    registerDecisionHooks({ answered })
    await decisionHooks().answered?.(item)
    expect(answered).toHaveBeenCalledWith(item)
  })

  it("replaces the previous registration rather than adding to it", async () => {
    const first = vi.fn()
    const second = vi.fn()
    registerDecisionHooks({ answered: first })
    registerDecisionHooks({ answered: second })
    await decisionHooks().answered?.(item)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
