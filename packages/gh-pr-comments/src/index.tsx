import React, { useCallback, useEffect, useState } from "react"
import { render, Box, Text, useApp, useInput } from "ink"
import { colors } from "@kud/ink-ui"
import { fetchPrComments, resolveCurrentPr, type PrComments } from "@kud/gh"
import { CommentsPanel } from "@kud/gh-ink"

type Target = { repo: string; number: number }

// Accept `owner/repo#123` or `owner/repo 123`; otherwise resolve the current
// branch's PR.
const parseRef = (arg?: string): Target | null => {
  if (!arg) return null
  const m = arg.match(/^([^/\s]+\/[^/#\s]+)[#\s](\d+)$/)
  return m ? { repo: m[1], number: Number(m[2]) } : null
}

const App = ({ target }: { target: Target }) => {
  const { exit } = useApp()
  const [data, setData] = useState<PrComments | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)

  const load = useCallback(() => {
    const [owner, name] = target.repo.split("/")
    fetchPrComments(owner, name, target.number)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [target])

  useEffect(load, [load])

  useInput((input) => {
    if (!replying && input === "q") exit()
  })

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={colors.accent}>
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
          ↑↓ move · x resolve · r reply · R resolved · q quit
        </Text>
      </Box>
    </Box>
  )
}

const main = async () => {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"))
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
