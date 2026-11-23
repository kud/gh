import React, { useEffect, useState } from "react"
import { render, Box, Text, useApp, useInput } from "ink"
import { colors } from "@kud/ink-ui"
import {
  fetchHookContexts,
  fetchHooks,
  fetchLatestPrDeliveryId,
  replayDelivery,
  replayLatestPrDelivery,
  resolveCurrentRepo,
  type Hook,
} from "@kud/gh"

type HookWithContexts = Hook & { contexts: string[] }
type Phase = "loading" | "pick" | "replaying"

// What the run came to, handed out of the Ink tree so `main` can print it once
// the alternate screen is gone. `lines[0]` is the ✓/✗ verdict; the rest say
// which hook and where it points, the same two lines command mode prints.
export type Outcome = { ok: boolean; lines: string[] }

const hookLabel = (hook: HookWithContexts): string => {
  if (hook.contexts.length > 0) return hook.contexts.join(", ")
  try {
    return (
      new URL(hook.config.url).pathname.replace(/^\/|\/$/g, "") || hook.name
    )
  } catch {
    return hook.name
  }
}
const hookHost = (hook: Hook): string => {
  try {
    return new URL(hook.config.url).hostname
  } catch {
    return hook.config.url
  }
}

// The result used to be drawn INSIDE the alternate screen and held for 1.8 s
// before exit, and leaving the alternate screen is exactly what throws its
// contents away — so the one line that said whether the replay landed was gone
// the moment it could have been read, failures included. A replay that errored
// left nothing in the scrollback to say it had. The App now reports and exits
// at once, and `main` prints the outcome to the normal screen, where it stays.
const App = ({
  repo,
  onFinish,
}: {
  repo: string
  onFinish: (outcome: Outcome) => void
}) => {
  const { exit } = useApp()
  const [phase, setPhase] = useState<Phase>("loading")
  const [hooks, setHooks] = useState<HookWithContexts[]>([])
  const [cursor, setCursor] = useState(0)

  const finish = (outcome: Outcome) => {
    onFinish(outcome)
    exit()
  }

  useEffect(() => {
    fetchHooks(repo)
      .then(async (hs) => {
        const withContexts = await Promise.all(
          hs.map(async (h) => ({
            ...h,
            contexts: await fetchHookContexts(repo, h.id),
          })),
        )
        setHooks(withContexts)
        setPhase("pick")
      })
      .catch((e: Error) => finish({ ok: false, lines: [`✗ ${e.message}`] }))
  }, [])

  useInput((input, key) => {
    if (input === "q") return exit()
    if (phase !== "pick") return
    if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === "j")
      setCursor((c) => Math.min(hooks.length - 1, c + 1))
    if (key.return) {
      const hook = hooks[cursor]
      if (!hook) return
      const where = `  ${hookLabel(hook)} · ${hook.config.url}`
      setPhase("replaying")
      fetchLatestPrDeliveryId(repo, hook.id)
        .then((id) =>
          replayDelivery(repo, hook.id, id).then(() =>
            finish({
              ok: true,
              lines: [`✓ Webhook replayed on ${repo}`, `${where} · delivery ${id}`],
            }),
          ),
        )
        .catch((e: Error) =>
          finish({ ok: false, lines: [`✗ ${e.message}`, where] }),
        )
    }
  })

  if (phase === "loading")
    return <Text color={colors.info}>Fetching webhooks…</Text>
  if (phase === "replaying")
    return <Text color={colors.info}>Replaying latest pull_request…</Text>

  return (
    <Box flexDirection="column">
      <Text bold color={colors.accent}>
        {repo} <Text dimColor>· pick a webhook to replay</Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {hooks.map((hook, i) => {
          const active = i === cursor
          return (
            <Box key={hook.id}>
              <Text color={colors.info}>{active ? "❯ " : "  "}</Text>
              <Box flexDirection="column">
                <Text bold={active} color={active ? colors.accent : undefined}>
                  {hookLabel(hook)}
                </Text>
                <Text dimColor>
                  {hookHost(hook)} · {hook.events.join(", ")}
                </Text>
              </Box>
            </Box>
          )
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ move · ↵ replay · q quit</Text>
      </Box>
    </Box>
  )
}

const main = async () => {
  const args = process.argv.slice(2)
  const hookIdx = args.indexOf("--hook")
  const hookPattern = hookIdx >= 0 ? args[hookIdx + 1] : undefined
  // Skip the `--hook` value, and only when there is one: without the guard,
  // `hookIdx + 1` is 0 when the flag is absent, so the first argument — the
  // repo, in the picker's only invocation — was always the one skipped and
  // `gh-webhook-replay owner/repo` fell back to the current directory's repo.
  const positional = args.find(
    (a, i) => !a.startsWith("-") && !(hookIdx >= 0 && i === hookIdx + 1),
  )
  const repo = positional ?? (await resolveCurrentRepo().catch(() => null))

  if (!repo) {
    console.error("✗ No repo — run inside a git repo, or pass owner/repo")
    process.exit(1)
  }

  // Command mode: replay the latest pull_request delivery on the matched hook.
  if (hookPattern) {
    try {
      const { hook, deliveryId } = await replayLatestPrDelivery(
        repo,
        hookPattern,
      )
      console.log(`✓ Webhook replayed on ${repo}`)
      console.log(`  ${hook.config.url} · delivery ${deliveryId}`)
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`)
      process.exit(1)
    }
    return
  }

  let outcome: Outcome | null = null
  const app = render(
    <App repo={repo} onFinish={(o) => (outcome = o)} />,
    { alternateScreen: true },
  )
  await app.waitUntilExit()
  // Narrowed by hand: TypeScript cannot see the callback assign it.
  const result = outcome as Outcome | null
  if (!result) return // `q` before anything happened: nothing to report.
  if (result.ok) console.log(result.lines.join("\n"))
  else {
    console.error(result.lines.join("\n"))
    process.exitCode = 1
  }
}

void main()
