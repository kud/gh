import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { configureInbox, resetInboxConfig } from "./config.js"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  cacheTtlMs,
  invalidateCache,
  isFresh,
  readCache,
  writeCache,
} from "./cache.js"

/*
 * The glance costs 73 GraphQL points a fetch, so what is being pinned here is
 * a spending policy, not a storage detail. Before this existed the cache was
 * read on mount and then refetched unconditionally — it recorded rather than
 * prevented, which is indistinguishable from working until someone counts.
 */

const KEY = "test-glance"
const cacheFile = () =>
  join(process.env.XDG_CACHE_HOME ?? "", "gh-ink", `${KEY}.json`)

const sections = [{ title: "Open", items: [] }] as never

beforeEach(() => {
  process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), "gh-ink-cache-"))
})

afterEach(() => {
  delete process.env.XDG_CACHE_HOME
})

describe("glance cache", () => {
  it("round-trips a written glance", async () => {
    writeCache(KEY, { sections, login: "kud" })
    expect(readCache(KEY)?.login).toBe("kud")
  })

  it("treats a just-written entry as fresh", async () => {
    writeCache(KEY, { sections, login: "kud" })
    expect(isFresh(readCache(KEY))).toBe(true)
  })

  // The gate. If this ever reads true, every launch pays 73 points again.
  it("treats an entry older than the TTL as stale", async () => {
    writeCache(KEY, { sections, login: "kud" })
    const cached = readCache(KEY)
    expect(isFresh(cached, Date.now() + cacheTtlMs() + 1)).toBe(false)
  })

  it("takes the TTL from the host, not a compiled-in constant", () => {
    // A reader who opens the cockpit every few minutes missed a fixed 120s cache
    // on essentially every launch and paid the full eight-search query each
    // time. The knob is the point; the default merely has to be sane.
    configureInbox({ cacheTtlMs: 1_000 })
    const cached = { sections: [], login: "me", at: Date.now() }
    expect(isFresh(cached, Date.now() + 500)).toBe(true)
    expect(isFresh(cached, Date.now() + 1_500)).toBe(false)
    resetInboxConfig()
  })

  it("treats a missing entry as stale rather than fresh", async () => {
    expect(isFresh(readCache("never-written"))).toBe(false)
  })

  /*
   * A file written by an older `Section` shape must not deserialise into new
   * code. Survivable while every launch overwrote the cache seconds later;
   * under a TTL the stale shape would be trusted and rendered.
   */
  it("misses rather than trusts a file from an older cache version", async () => {
    writeCache(KEY, { sections, login: "kud" })
    const raw = JSON.parse(readFileSync(cacheFile(), "utf8"))
    writeFileSync(cacheFile(), JSON.stringify({ ...raw, version: 0 }))
    expect(readCache(KEY)).toBeNull()
  })

  // Every cache file written before this change looks exactly like this.
  it("misses on a file with no version at all", async () => {
    writeCache(KEY, { sections, login: "kud" })
    writeFileSync(
      cacheFile(),
      JSON.stringify({ sections, login: "kud", at: Date.now() }),
    )
    expect(readCache(KEY)).toBeNull()
  })

  /*
   * Actions schedule their refresh behind a delay so GitHub can settle. Quitting
   * inside that window used to leave pre-action rows on disk — harmless when the
   * next launch always refetched, a visible wrong answer once the TTL trusts it.
   */
  it("drops the entry outright when an action lands", async () => {
    writeCache(KEY, { sections, login: "kud" })
    expect(existsSync(cacheFile())).toBe(true)
    invalidateCache(KEY)
    expect(existsSync(cacheFile())).toBe(false)
    expect(readCache(KEY)).toBeNull()
  })

  it("is a no-op rather than a throw when there is nothing to drop", async () => {
    expect(() => invalidateCache("never-written")).not.toThrow()
  })
})
