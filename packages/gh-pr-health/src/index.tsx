import React, { useCallback, useEffect, useState } from "react"
import { render, Box, Text, useApp, useInput } from "ink"
import { execa } from "execa"
import { colors } from "@kud/ink-ui"
import {
  fetchHealth,
  resolveCurrentPr,
  retriggerJenkinsWebhook,
  type PrCheck,
  type PrHealthData,
} from "@kud/gh"
import { HealthPanel } from "@kud/gh-ink"

type Target = { repo: string; number: number }

const parseRef = (arg?: string): Target | null => {
  if (!arg) return null
  const m = arg.match(/^([^/\s]+\/[^/#\s]+)[#\s](\d+)$/)
  return m ? { repo: m[1], number: Number(m[2]) } : null
}

const openUrl = (url: string) => {
  if (url) void execa("open", [url]).catch(() => {})
}

const App = ({ target }: { target: Target }) => {
  const { exit } = useApp()
  const [data, setData] = useState<PrHealthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchHealth(target.repo, target.number)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [target])

  useEffect(load, [load])
  useInput((input) => {
    if (input === "q") exit()
  })

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={colors.accent}>
          {target.repo} #{target.number}
        </Text>
        <Text dimColor> · health</Text>
      </Box>
      <HealthPanel
        repo={target.repo}
        number={target.number}
        data={data}
        error={error}
        reload={load}
        onOpenCheck={(c: PrCheck) => openUrl(c.detailsUrl ?? c.targetUrl ?? "")}
      />
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓ move · ↵ open check · r retrigger CI · m merge · q quit
        </Text>
      </Box>
    </Box>
  )
}

const main = async () => {
  const args = process.argv.slice(2)
  const arg = args.find((a) => !a.startsWith("-"))
  const target =
    parseRef(arg) ??
    (await resolveCurrentPr()
      .then((pr) => ({ repo: pr.repo, number: pr.number }))
      .catch(() => null))

  if (!target) {
    console.error(
      "✗ No PR found — run inside a repo on a PR branch, or pass owner/repo#123",
    )
    process.exit(1)
  }

  // Headless: re-fire the Jenkins PR-builder webhook for this PR's repo.
  if (args.includes("--retrigger")) {
    try {
      const { deliveryId } = await retriggerJenkinsWebhook(target.repo)
      console.log(`✓ CI retriggered on ${target.repo} (delivery ${deliveryId})`)
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`)
      process.exit(1)
    }
    return
  }

  render(<App target={target} />, { alternateScreen: true })
}

void main()
