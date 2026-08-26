import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { useState, useEffect } from "react"
import type { Section } from "./inbox.js"
import { inboxConfig } from "./config.js"

// On-disk cache for the inbox glance, so launch renders instantly from the last
// known state while the network revalidates in the background. One file per
// profile (home / work) under XDG_CACHE_HOME.

/**
 * How long a cached glance is trusted before launch refetches it.
 *
 * The glance costs **111 GraphQL points** — measured via `rateLimit { cost }`,
 * at a nodeCount of 25,550 — against a 5000/hour account-wide pool shared with
 * everything else `gh` touches. Until this existed the cache was painted on
 * mount and then refetched unconditionally, so it bought a fast first frame and
 * saved nothing at all: a cache that records rather than prevents.
 *
 * Host-configurable via `cacheTtlMs`, defaulting to 10 minutes.
 *
 * It was a fixed 120s, chosen to bound the pathological case — thirty launches
 * an hour — rather than the typical one. That inverted the cost: nobody launches
 * thirty times an hour, but a reader who opens the cockpit every few minutes
 * missed the cache on essentially every launch and paid the full eight-search
 * query each time, which is also what draws 502s out of the API.
 *
 * 10 minutes still bounds the pathological case comfortably (six full fetches an
 * hour, whatever the launch rate), while making the ordinary rhythm — glance,
 * close, glance again — free. Staleness is bounded from the other end anyway:
 * acting on a row drops the entry, and `r` forces a refetch.
 */
export const cacheTtlMs = (): number => inboxConfig().cacheTtlMs

/**
 * Bump when `CachedCockpit`'s shape changes.
 *
 * `readCache` used to validate only that `sections` was an array, which was
 * survivable while the cache was overwritten seconds after every launch. Once a
 * TTL lets an entry be *trusted*, a file written by an older `Section` shape
 * would deserialise into new code and render wrong. An unrecognised version is
 * a miss, which costs one cold fetch on upgrade.
 *
 * 2 — the `jira` row kind became `task`. A v1 cache full of `kind: "jira"` rows
 * deserialised into a build that no longer has a branch for them, so every one
 * fell through to the GitHub row and crashed on `healthDisplay[item.health]`.
 * Not a degraded render: a full-screen React error on launch, cleared only by
 * the refetch landing underneath it.
 */
const CACHE_VERSION = 2

export type CachedCockpit = { sections: Section[]; login: string; at: number }

const cacheDir = (): string =>
  join(
    process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
    inboxConfig().cacheNamespace,
  )

const cacheFile = (key: string): string =>
  join(cacheDir(), `${key.replace(/[^a-z0-9._-]/gi, "-")}.json`)

export const readCache = (key: string): CachedCockpit | null => {
  try {
    const raw = JSON.parse(readFileSync(cacheFile(key), "utf8"))
    if (raw?.version !== CACHE_VERSION) return null
    if (!Array.isArray(raw?.sections)) return null
    return { sections: raw.sections, login: raw.login ?? "", at: raw.at ?? 0 }
  } catch {
    return null
  }
}

/** Whether a cached glance is young enough to launch on without refetching. */
export const isFresh = (
  cached: CachedCockpit | null,
  now = Date.now(),
): boolean => !!cached && now - cached.at < cacheTtlMs()

export const writeCache = (
  key: string,
  data: { sections: Section[]; login: string },
): void => {
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(
      cacheFile(key),
      JSON.stringify({ version: CACHE_VERSION, ...data, at: Date.now() }),
    )
  } catch {
    // cache is best-effort — never let a write failure break the inbox
  }
}

/**
 * Drop a cached glance the moment an action makes it wrong.
 *
 * Synchronous and at action time, not at refresh time. The handlers schedule
 * their refresh behind `setTimeout(…, 1500)` to let GitHub settle, so quitting
 * inside that window leaves pre-action state on disk. Harmless while every
 * launch refetched; under the TTL it means merging a PR, quitting, relaunching,
 * and finding the row still there.
 */
export const invalidateCache = (key: string): void => {
  try {
    rmSync(cacheFile(key), { force: true })
  } catch {
    // best-effort, same as the write
  }
}

// Generic keyed JSON cache for drill-view content (health / comments), stored
// as { v, at } so any shape can round-trip.
const readJson = <T>(key: string): T | null => {
  try {
    return (JSON.parse(readFileSync(cacheFile(key), "utf8")) as { v: T }).v
  } catch {
    return null
  }
}

const writeJson = <T>(key: string, v: T): void => {
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(cacheFile(key), JSON.stringify({ v, at: Date.now() }))
  } catch {
    // best-effort
  }
}

// Cache-and-network for a drill resource: renders the cached value instantly
// (no loading flash when cached), revalidates in the background, and — unlike
// the glance — auto-applies the fresh value, since the user opened this view
// deliberately to see current state. `reload` re-fetches (after an action).
export const useCachedResource = <T>(
  key: string,
  fetcher: () => Promise<T>,
): {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
} => {
  const [data, setData] = useState<T | null>(() => readJson<T>(key))
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    fetcher()
      .then((fresh) => {
        if (!live) return
        writeJson(key, fresh)
        setData(fresh)
        setError(null)
      })
      .catch((e) => live && setError((e as Error).message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])

  return {
    data,
    error,
    loading: data === null && error === null,
    reload: () => setTick((t) => t + 1),
  }
}
