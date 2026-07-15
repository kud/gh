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
type Phase = "loading" | "pick" | "replaying" | "done" | "error"

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

const App = ({ repo }: { repo: string }) => {
  const { exit } = useApp()
  const [phase, setPhase] = useState<Phase>("loading")
  const [hooks, setHooks] = useState<HookWithContexts[]>([])
  const [cursor, setCursor] = useState(0)
  const [msg, setMsg] = useState("")

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
      .catch((e: Error) => {
        setMsg(e.message)
        setPhase("error")
      })
  }, [])

  useEffect(() => {
    if (phase !== "done" && phase !== "error") return
    const t = setTimeout(exit, 1800)
    return () => clearTimeout(t)
  }, [phase])

  useInput((input, key) => {
    if (input === "q") return exit()
    if (phase !== "pick") return
    if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === "j")
      setCursor((c) => Math.min(hooks.length - 1, c + 1))
    if (key.return) {
      const hook = hooks[cursor]
      setPhase("replaying")
      fetchLatestPrDeliveryId(repo, hook.id)
        .then((id) =>
          replayDelivery(repo, hook.id, id).then(() => {
            setMsg(`delivery ${id}`)
            setPhase("done")
          }),
        )
        .catch((e: Error) => {
          setMsg(e.message)
          setPhase("error")
        })
    }
  })

  if (phase === "loading")
    return <Text color={colors.info}>Fetching webhooks…</Text>
  if (phase === "replaying")
    return <Text color={colors.info}>Replaying latest pull_request…</Text>
  if (phase === "done")
    return (
      <Text color={colors.success}>
        ✓ Webhook replayed on {repo} · {msg}
      </Text>
    )
  if (phase === "error") return <Text color={colors.error}>✗ {msg}</Text>

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
  const positional = args.find(
    (a, i) => !a.startsWith("-") && i !== hookIdx + 1,
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

  render(<App repo={repo} />, { alternateScreen: true })
}

void main()
