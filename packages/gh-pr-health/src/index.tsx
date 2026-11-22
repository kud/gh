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
import { FIXTURES, SCREENS, type Fixture } from "./fixtures.js"

type Target = { repo: string; number: number }

const parseRef = (arg?: string): Target | null => {
  if (!arg) return null
  const m = arg.match(/^([^/\s]+\/[^/#\s]+)[#\s](\d+)$/)
  return m ? { repo: m[1], number: Number(m[2]) } : null
}

const openUrl = (url: string) => {
  if (url) void execa("open", [url]).catch(() => {})
}

// The flag values cli-shot passes are words too, so the positional PR ref has
// to be looked for with them taken out — otherwise `--screen list` reads as a
// ref called "list" and the run goes looking for a PR that does not exist.
const flagValue = (args: string[], flag: string): string | undefined => {
  const at = args.indexOf(flag)
  return at === -1 ? undefined : args[at + 1]
}

const positional = (args: string[]): string | undefined =>
  args.find((a, i) => !a.startsWith("-") && args[i - 1] !== "--screen")

const App = ({ target, fixture }: { target: Target; fixture?: Fixture }) => {
  const { exit } = useApp()
  const [data, setData] = useState<PrHealthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    // Mock mode never reaches `gh`: the fixture arrives after a beat so a
    // recording shows the same "Fetching status…" frame a real run opens on.
    if (fixture) {
      const timer = setTimeout(() => setData(fixture.data), 120)
      return () => clearTimeout(timer)
    }
    fetchHealth(target.repo, target.number)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [target, fixture])

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
        onOpenCheck={(c: PrCheck) =>
          fixture ? undefined : openUrl(c.detailsUrl ?? c.targetUrl ?? "")
        }
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
  const screen = flagValue(args, "--screen")

  // The cli-shot contract: `--screen list` names the screens, `--screen <name>`
  // opens one, `--mock` swaps every data source for the invented fixtures.
  if (screen === "list") {
    console.log(SCREENS.join("\n"))
    return
  }
  if (args.includes("--mock")) {
    const fixture = FIXTURES[screen ?? SCREENS[0]]
    if (!fixture) {
      console.error(`✗ No screen called ${screen} — try --screen list`)
      process.exit(2)
    }
    render(
      <App
        target={{ repo: fixture.repo, number: fixture.number }}
        fixture={fixture}
      />,
      { alternateScreen: true },
    )
    return
  }

  const arg = positional(args)
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
