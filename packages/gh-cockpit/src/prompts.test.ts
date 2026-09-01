import { beforeEach, describe, expect, it } from "vitest"

import {
  portablePromptFor,
  registerPrompts,
  seedPromptFor,
  type PromptContext,
} from "./prompts.js"

/*
 * These are the defaults a fresh install gets — nobody registers `seed` or
 * `portable` until a host (this package's own author) opts in. Pin them
 * because they used to be four hardcoded templates naming `/k-pr` and
 * `/k-project`, slash commands only the author has; a stranger pressing `a`
 * launched an agent with a command it would refuse. `registerPrompts`
 * mutates module-level state, so every test resets the registry first rather
 * than relying on run order to leave it empty.
 */

const item: PromptContext = {
  kind: "pr",
  number: 42,
  repo: "kud/gh-cockpit",
  url: "https://github.com/kud/gh-cockpit/pull/42",
}

beforeEach(() => {
  registerPrompts({})
})

describe("seedPromptFor", () => {
  it("is undefined when nothing is registered, so the agent starts cold", () => {
    expect(seedPromptFor(item)).toBeUndefined()
  })

  it("returns what the host supplies", () => {
    registerPrompts({ seed: (ctx) => `work on #${ctx.number}` })
    expect(seedPromptFor(item)).toBe("work on #42")
  })

  it("stays undefined when only portable is registered", () => {
    registerPrompts({ portable: (ctx) => ctx.url })
    expect(seedPromptFor(item)).toBeUndefined()
  })
})

describe("portablePromptFor", () => {
  it("falls back to the row's URL when nothing is registered", () => {
    // Deliberate: a bare link pasted into an already-warm session is the
    // habit the `y` key exists to save, and it is portable by construction.
    expect(portablePromptFor(item)).toBe(item.url)
  })

  it("returns what the host supplies", () => {
    registerPrompts({
      portable: (ctx) => `${ctx.repo}#${ctx.number} — ${ctx.url}`,
    })
    expect(portablePromptFor(item)).toBe(
      "kud/gh-cockpit#42 — https://github.com/kud/gh-cockpit/pull/42",
    )
  })

  it("falls back to the URL when only seed is registered", () => {
    registerPrompts({ seed: (ctx) => `work on #${ctx.number}` })
    expect(portablePromptFor(item)).toBe(item.url)
  })
})
