import { ghRest } from "./gh.js"

export type Hook = {
  id: number
  name: string
  config: { url: string }
  events: string[]
  active: boolean
}

// The id of the most recent `pull_request` delivery in a hook's deliveries
// listing, or null if none. The listing is newest-first, so the first match is
// the latest. Parses the JSON array — the old shell tools text-scanned for
// `"pull_request"` and walked back to a nearby `"id"`, which silently depended
// on pretty-printed output; parsing is equivalent and robust.
export const parsePrDeliveryId = (raw: string): string | null => {
  const deliveries = JSON.parse(raw) as Array<{ id: number; event: string }>
  const pr = deliveries.find((d) => d.event === "pull_request")
  return pr ? String(pr.id) : null
}

export const fetchHooks = async (repo: string): Promise<Hook[]> =>
  JSON.parse(await ghRest(`repos/${repo}/hooks`, { method: "GET" })) as Hook[]

export const fetchLatestPrDeliveryId = async (
  repo: string,
  hookId: number,
): Promise<string> => {
  const raw = await ghRest(
    `repos/${repo}/hooks/${hookId}/deliveries?per_page=20`,
    { method: "GET" },
  )
  const id = parsePrDeliveryId(raw)
  if (!id) throw new Error(`No pull_request delivery found for hook ${hookId}`)
  return id
}

export const replayDelivery = async (
  repo: string,
  hookId: number,
  deliveryId: string,
): Promise<void> => {
  await ghRest(
    `repos/${repo}/hooks/${hookId}/deliveries/${deliveryId}/attempts`,
    { method: "POST" },
  )
}

// Match a hook by url substring or exact numeric id (the CLI `--hook` pattern).
export const findHook = (hooks: Hook[], pattern: string): Hook | undefined =>
  hooks.find((h) => h.config.url.includes(pattern) || String(h.id) === pattern)

// The Jenkins PR-builder hook, by its well-known url markers.
export const findJenkinsHook = (hooks: Hook[]): Hook | undefined =>
  hooks.find(
    (h) =>
      h.config.url.includes("ghprbhook") || h.config.url.includes("jenkins"),
  )

// The status contexts a hook's latest pull_request delivery produced — derived
// from the delivered head sha's commit statuses. Best-effort: returns [] rather
// than throwing so a picker can still list the hook.
export const fetchHookContexts = async (
  repo: string,
  hookId: number,
): Promise<string[]> => {
  try {
    const listing = await ghRest(
      `repos/${repo}/hooks/${hookId}/deliveries?per_page=5`,
      { method: "GET" },
    )
    const deliveryId = parsePrDeliveryId(listing)
    if (!deliveryId) return []

    const delivery = JSON.parse(
      await ghRest(`repos/${repo}/hooks/${hookId}/deliveries/${deliveryId}`, {
        method: "GET",
      }),
    )
    const sha: string | undefined =
      delivery?.request?.payload?.pull_request?.head?.sha
    if (!sha) return []

    const statuses = JSON.parse(
      await ghRest(`repos/${repo}/commits/${sha}/statuses`, { method: "GET" }),
    ) as Array<{ context: string }>

    return [...new Set(statuses.map((s) => s.context))]
  } catch {
    return []
  }
}

export type ReplayResult = { hook: Hook; deliveryId: string }

// Replay the latest pull_request delivery on the hook matching `pattern`
// (gh-webhook-replay command mode).
export const replayLatestPrDelivery = async (
  repo: string,
  pattern: string,
): Promise<ReplayResult> => {
  const hooks = await fetchHooks(repo)
  const hook = findHook(hooks, pattern)
  if (!hook) throw new Error(`No webhook matching "${pattern}" on ${repo}`)
  const deliveryId = await fetchLatestPrDeliveryId(repo, hook.id)
  await replayDelivery(repo, hook.id, deliveryId)
  return { hook, deliveryId }
}

// Re-fire the Jenkins PR-builder hook's latest pull_request delivery
// (gh-pr-health --retrigger).
export const retriggerJenkinsWebhook = async (
  repo: string,
): Promise<ReplayResult> => {
  const hooks = await fetchHooks(repo)
  const hook = findJenkinsHook(hooks)
  if (!hook) throw new Error("No Jenkins webhook found")
  const deliveryId = await fetchLatestPrDeliveryId(repo, hook.id)
  await replayDelivery(repo, hook.id, deliveryId)
  return { hook, deliveryId }
}
