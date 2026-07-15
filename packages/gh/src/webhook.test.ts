import { beforeEach, describe, expect, it, vi } from "vitest"
import { execa } from "execa"
import {
  fetchHooks,
  findHook,
  findJenkinsHook,
  parsePrDeliveryId,
  replayLatestPrDelivery,
  retriggerJenkinsWebhook,
  type Hook,
} from "./index.js"

vi.mock("execa", () => ({ execa: vi.fn() }))
const mockedExeca = vi.mocked(execa)
const stdout = (s: string) => ({ stdout: s }) as never

beforeEach(() => mockedExeca.mockReset())

const hook = (over: Partial<Hook>): Hook => ({
  id: 1,
  name: "web",
  config: { url: "https://example.com" },
  events: ["pull_request"],
  active: true,
  ...over,
})

describe("parsePrDeliveryId", () => {
  it("returns the id of the latest (first) pull_request delivery", () => {
    const raw = JSON.stringify([
      { id: 222, event: "pull_request" },
      { id: 111, event: "push" },
      { id: 100, event: "pull_request" },
    ])
    expect(parsePrDeliveryId(raw)).toBe("222")
  })

  it("returns null when there is no pull_request delivery", () => {
    expect(
      parsePrDeliveryId(JSON.stringify([{ id: 1, event: "push" }])),
    ).toBeNull()
  })
})

describe("findHook / findJenkinsHook", () => {
  const hooks = [
    hook({ id: 10, config: { url: "https://ci.example/ghprbhook/" } }),
    hook({ id: 20, config: { url: "https://hooks.slack.com/x" } }),
  ]
  it("matches by url substring or numeric id", () => {
    expect(findHook(hooks, "slack")?.id).toBe(20)
    expect(findHook(hooks, "10")?.id).toBe(10)
    expect(findHook(hooks, "nope")).toBeUndefined()
  })
  it("finds the jenkins/ghprb hook", () => {
    expect(findJenkinsHook(hooks)?.id).toBe(10)
  })
})

describe("fetchHooks", () => {
  it("lists repo webhooks via gh api", async () => {
    mockedExeca.mockResolvedValueOnce(stdout(JSON.stringify([hook({ id: 5 })])))
    const hooks = await fetchHooks("kud/gh")
    expect(hooks).toHaveLength(1)
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "api",
      "repos/kud/gh/hooks",
      "-X",
      "GET",
    ])
  })
})

describe("replayLatestPrDelivery", () => {
  it("finds the hook, resolves the latest PR delivery, and POSTs a replay", async () => {
    mockedExeca
      .mockResolvedValueOnce(
        stdout(
          JSON.stringify([
            hook({ id: 42, config: { url: "https://ci/ghprbhook/" } }),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        stdout(JSON.stringify([{ id: 999, event: "pull_request" }])),
      )
      .mockResolvedValueOnce(stdout(""))

    const result = await replayLatestPrDelivery("kud/gh", "ghprbhook")

    expect(result.hook.id).toBe(42)
    expect(result.deliveryId).toBe("999")
    expect(mockedExeca).toHaveBeenLastCalledWith("gh", [
      "api",
      "repos/kud/gh/hooks/42/deliveries/999/attempts",
      "-X",
      "POST",
    ])
  })

  it("throws when no hook matches the pattern", async () => {
    mockedExeca.mockResolvedValueOnce(stdout(JSON.stringify([hook({ id: 1 })])))
    await expect(replayLatestPrDelivery("kud/gh", "nope")).rejects.toThrow(
      'No webhook matching "nope" on kud/gh',
    )
  })
})

describe("retriggerJenkinsWebhook", () => {
  it("throws when no Jenkins hook is configured", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdout(JSON.stringify([hook({ config: { url: "https://slack/x" } })])),
    )
    await expect(retriggerJenkinsWebhook("kud/gh")).rejects.toThrow(
      "No Jenkins webhook found",
    )
  })
})
