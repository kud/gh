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
  /*
   * This used to be undefined — a cold start — which was right while any
   * fallback would have had to invent a command. Prose does not: a sentence
   * carrying a URL belongs to no agent's dialect, so there is something honest
   * to say by default and no reason to say nothing.
   */
  it("falls back to prose carrying the URL, not to silence", () => {
    const seed = seedPromptFor(item)
    expect(seed).toContain(item.url)
    expect(seed).toMatch(/pull request/i)
  })

  it("names an issue as an issue rather than a pull request", () => {
    expect(seedPromptFor({ ...item, kind: "issue" })).toMatch(/issue/i)
  })

  /*
   * The property that actually matters, and the reason this is prose at all.
   * The launcher hands ONE string to whichever agent was picked, so a default
   * phrased in any agent's idiom fails in another's — and fails inside the
   * agent, minutes later, where nothing in the cockpit looks wrong. That is how
   * `/k-pr 733` reached Codex.
   */
  it("carries no command vocabulary, so any agent can read it", () => {
    for (const kind of ["pr", "issue"] as const) {
      const seed = seedPromptFor({ ...item, kind }) ?? ""
      expect(seed.startsWith("/")).toBe(false)
      expect(seed).not.toMatch(/^[\w-]+\s+--/)
    }
  })

  it("returns what the host supplies, in preference to the default", () => {
    registerPrompts({ seed: (ctx) => `work on #${ctx.number}` })
    expect(seedPromptFor(item)).toBe("work on #42")
  })

  it("still defaults when only portable is registered", () => {
    registerPrompts({ portable: (ctx) => ctx.url })
    expect(seedPromptFor(item)).toContain(item.url)
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
