import { describe, it, expect } from "vitest"
import { stripSignature } from "./index.js"

/*
 * The strip poller bails out on a signature match the same way the CI line
 * does (`sameCiStatusState`), so a poll that says what the last one said must
 * not repaint the screen. `stripSignature` is what "says what it said" means:
 * it names the items and their states, and deliberately ignores WHEN the
 * snapshot was taken — `at` changes on every poll by construction, and
 * comparing it would defeat the bail-out on every single tick.
 */
describe("stripSignature", () => {
  it("is the same signature for the same items even when the timestamp moves", () => {
    const a = {
      title: "services",
      items: [{ key: "api", state: "ok" as const }],
      at: 1_000,
    }
    const b = { ...a, at: 2_000 }
    expect(stripSignature(a)).toBe(stripSignature(b))
  })

  it("changes when an item's state changes", () => {
    const ok = {
      title: "services",
      items: [{ key: "api", state: "ok" as const }],
    }
    const failed = {
      title: "services",
      items: [{ key: "api", state: "fail" as const }],
    }
    expect(stripSignature(ok)).not.toBe(stripSignature(failed))
  })

  it("changes when the alarm mark flips, even with the same state", () => {
    const plain = {
      title: "services",
      items: [{ key: "api", state: "ok" as const }],
    }
    const alarmed = {
      title: "services",
      items: [{ key: "api", state: "ok" as const, alarm: true }],
    }
    expect(stripSignature(plain)).not.toBe(stripSignature(alarmed))
  })

  // `null` — "nothing configured" — is a real answer and must never collapse
  // onto an empty strip's signature; the two are different claims about the
  // world and the poller must be able to tell them apart.
  it("gives null a signature distinct from an empty strip", () => {
    const empty = { title: "services", items: [] }
    expect(stripSignature(null)).not.toBe(stripSignature(empty))
  })
})
