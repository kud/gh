import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { useState, useEffect } from "react"
import type { Section } from "./inbox.js"

// On-disk cache for the inbox glance, so launch renders instantly from the last
// known state while the network revalidates in the background. One file per
// profile (home / work) under XDG_CACHE_HOME.

export type CachedCockpit = { sections: Section[]; login: string; at: number }

const cacheDir = (): string =>
  join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "ambre")

const cacheFile = (key: string): string =>
  join(cacheDir(), `${key.replace(/[^a-z0-9._-]/gi, "-")}.json`)

export const readCache = (key: string): CachedCockpit | null => {
  try {
    const raw = JSON.parse(readFileSync(cacheFile(key), "utf8"))
    if (!Array.isArray(raw?.sections)) return null
    return { sections: raw.sections, login: raw.login ?? "", at: raw.at ?? 0 }
  } catch {
    return null
  }
}

export const writeCache = (
  key: string,
  data: { sections: Section[]; login: string },
): void => {
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(cacheFile(key), JSON.stringify({ ...data, at: Date.now() }))
  } catch {
    // cache is best-effort — never let a write failure break the inbox
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
