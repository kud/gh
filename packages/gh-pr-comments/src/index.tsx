import React, { useCallback, useEffect, useState } from "react"
import { render, Box, Text, useApp, useInput, useWindowSize } from "ink"
import { fetchPrComments, resolveCurrentPr, type PrComments } from "@kud/gh"
import { CommentsPanel } from "@kud/gh-ink"
import { FIXTURES, SCREENS, type Fixture } from "./fixtures.js"

type Target = { repo: string; number: number }

// Accept `owner/repo#123` or `owner/repo 123`; otherwise resolve the current
// branch's PR.
const parseRef = (arg?: string): Target | null => {
  if (!arg) return null
  const m = arg.match(/^([^/\s]+\/[^/#\s]+)[#\s](\d+)$/)
  return m ? { repo: m[1], number: Number(m[2]) } : null
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
  const [data, setData] = useState<PrComments | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)
  const { rows } = useWindowSize()

  const load = useCallback(() => {
    // Mock mode never reaches `gh`: the fixture arrives after a beat so a
    // recording shows the same "Fetching comments…" frame a real run opens on.
    if (fixture) {
      const timer = setTimeout(() => setData(fixture.data), 120)
      return () => clearTimeout(timer)
    }
    const [owner, name] = target.repo.split("/")
    fetchPrComments(owner, name, target.number)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [target, fixture])

  useEffect(load, [load])

  useInput((input) => {
    if (!replying && input === "q") exit()
  })

  // The root takes the terminal's full height because CommentsPanel's
  // ScrollView sizes its window by measuring a flexGrow box, and a flexGrow box
  // inside a parent of no fixed height grows into nothing. Without it the
  // window measured one row and stayed there: the standalone CLI showed a
  // single line of the review and a "18–18 / 37" indicator, in every terminal.
  // Cockpit never showed it, because its host already hands the panel a sized
  // region — which is why it went unnoticed until the first recording of it.
  return (
    <Box flexDirection="column" height={rows}>
      {/* Bold, not accent: in this CLI the accent marks the selected thread and
          nothing else, so a title in the same orange was a second cursor. */}
      <Box>
        <Text bold>
          {target.repo} #{target.number}
        </Text>
        <Text dimColor> · review comments</Text>
      </Box>
      <CommentsPanel
        repo={target.repo}
        number={target.number}
        data={data}
        error={error}
        reload={load}
        onReplyingChange={setReplying}
      />
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓ move · x resolve · r reply · R unfold resolved · q quit
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

  render(<App target={target} />, { alternateScreen: true })
}

void main()
