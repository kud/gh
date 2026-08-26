import { $ } from "zx"
import React, { useState, useEffect, useRef } from "react"
import { Box, Text, useInput } from "ink"
import { colors, useListCursor } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"
import {
  buildCheckoutCmd,
  clipboard,
  openInTab,
  runInPane,
  runInPaneHorizontal,
  runHere,
} from "../lib.js"

type Agent = {
  id: string
  label: string
  cmd: string
  acceptsPrompt?: boolean
}
type Placement = "here" | "tab" | "vpane" | "hpane"

// AI agents we know how to launch — only those actually on PATH are offered.
//
// acceptsPrompt is per-agent because a seeded prompt is NOT a uniform trailing
// argument. `claude [prompt]` and `codex [PROMPT]` take one and stay interactive;
// opencode's positional is `[project]`, a path — handing it a prompt makes it try
// to start in a directory called "/k-pr 42". Its message form, `opencode run`, is
// headless, which throws away the conversation this handoff exists to open. So
// opencode launches warm but cold-started, and the UI says so rather than
// silently dropping the seed.
export const CANDIDATES: Agent[] = [
  { id: "claude", label: "Claude Code", cmd: "claude", acceptsPrompt: true },
  { id: "opencode", label: "opencode", cmd: "opencode" },
  { id: "codex", label: "Codex", cmd: "codex", acceptsPrompt: true },
]

const PLACEMENTS: { id: Placement; label: string }[] = [
  { id: "here", label: "Right here" },
  { id: "tab", label: "New tab" },
  { id: "vpane", label: "New pane  →  (right)" },
  { id: "hpane", label: "New pane  ↓  (below)" },
]

const isInstalled = async (cmd: string): Promise<boolean> =>
  (await $({ nothrow: true, quiet: true })`command -v ${cmd}`).exitCode === 0

// The command reaches iTerm2 through the ITERM_CMD env var and `write text`, so
// AppleScript never sees the string — but a shell does, and it types it verbatim.
const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

// What a delegated session is told to do: a pointer and an intent, never a
// payload. The session has `gh` and can fetch the body itself, so passing it
// duplicates that work and puts a multi-line body through a layer of shell
// quoting for no gain. A plan-labelled issue gets /k-project's plan form, which
// is the one that resumes rather than re-derives.
export const seedPromptFor = (item: {
  kind: "pr" | "issue"
  number: number
  url: string
  labels?: string[]
}): string =>
  item.kind === "pr"
    ? `/k-pr ${item.number}`
    : item.labels?.includes("plan")
      ? `/k-project plan ${item.number}`
      : `/k-project ${item.url}`

// The same intent as seedPromptFor, addressed to a session whose working
// directory we do not control. The launcher can afford a bare `/k-pr 42` because
// it cds into the checkout first; a prompt on the clipboard lands wherever it is
// pasted — an atelier session sits in ~/Companies/atelier, where that number
// resolves against no repo at all. Every reference here is repo-qualified for
// that reason, and the URL forms are already portable as they stand.
export const portablePromptFor = (item: {
  kind: "pr" | "issue"
  number: number
  repo: string
  url: string
  labels?: string[]
}): string =>
  item.kind === "pr"
    ? `/k-pr ${item.url}`
    : item.labels?.includes("plan")
      ? `/k-project plan ${item.number} ${item.repo}`
      : `/k-project ${item.url}`

// The no-launch half of delegation: put the prompt on the clipboard for a session
// that is already warm elsewhere, rather than starting a cold one. Shows the exact
// text instead of a bare "copied" — it is about to be pasted somewhere with no
// other context, so reading it before it goes is the point — then dismisses
// itself; any key dismisses it sooner.
export const CopyPromptNotice = ({
  item,
  onBack,
}: {
  item: {
    kind: "pr" | "issue"
    number: number
    repo: string
    url: string
    labels?: string[]
  }
  onBack: () => void
}) => {
  const prompt = portablePromptFor(item)
  // Through a ref so an inline onBack from the caller cannot re-arm the timer on
  // every render, which would copy repeatedly and leave the panel up for good.
  const back = useRef(onBack)
  back.current = onBack

  useEffect(() => {
    clipboard(prompt)
    const timer = setTimeout(() => back.current(), 1400)
    return () => clearTimeout(timer)
  }, [prompt])

  useInput(() => back.current())

  return (
    <DrillView
      title={`Copy prompt · #${item.number} · ${item.repo}`}
      subtitle="paste it into a session that is already running"
      hints={[["any key", "back"]]}
    >
      <Box flexDirection="column">
        <Text color={colors.success}>✓ copied to clipboard</Text>
        <Box marginTop={1}>
          <Text dimColor>{`prompt  ${prompt}`}</Text>
        </Box>
      </Box>
    </DrillView>
  )
}

// Two-step launcher overlay: choose the agent, then where to open it. Opens the
// item's repo — its branch too, for a PR — resolved to a local checkout via
// buildCheckoutCmd, with the chosen agent. A legitimate spawn: an interactive
// agent is its own program. Item-shaped rather than PR-shaped because an issue
// delegates through the same screen; it simply has no branch, which
// buildCheckoutCmd already treats as "stay where you land".
export const AiLauncher = ({
  item,
  login,
  prompt,
  onBack,
}: {
  item: { number: number; repo: string; branch?: string }
  login: string
  prompt?: string
  onBack: () => void
}) => {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [step, setStep] = useState<"agent" | "place">("agent")
  const [agent, setAgent] = useState<Agent | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all(
      CANDIDATES.map(async (a) => ((await isInstalled(a.cmd)) ? a : null)),
    ).then((found) => {
      if (!live) return
      const shell: Agent = { id: "shell", label: "Shell (no AI)", cmd: "" }
      setAgents([...found.filter((a): a is Agent => a !== null), shell])
    })
    return () => {
      live = false
    }
  }, [])

  const list: { label: string; hint?: string }[] =
    step === "agent"
      ? (agents ?? []).map((a) => ({ label: a.label, hint: a.cmd }))
      : PLACEMENTS.map((p) => ({ label: p.label }))
  const { cursor, setCursor } = useListCursor(list.length)
  const safeCursor = Math.min(cursor, Math.max(0, list.length - 1))
  // Whichever agent the seed line is currently talking about: the highlighted one
  // while choosing, the chosen one afterwards.
  const focused = step === "agent" ? (agents ?? [])[safeCursor] : agent

  const launch = async (a: Agent, placement: Placement) => {
    setNote(`⋯ opening ${a.label}…`)
    try {
      const base = await buildCheckoutCmd(item.repo, item.branch ?? "", login)
      const run =
        prompt && a.acceptsPrompt ? `${a.cmd} ${shellQuote(prompt)}` : a.cmd
      const full = a.cmd ? `${base} && ${run}` : base
      if (placement === "here") {
        runHere(full)
        process.exit(0)
      }
      if (placement === "tab") await openInTab(full)
      if (placement === "vpane") await runInPane(full)
      if (placement === "hpane") await runInPaneHorizontal(full)
      setNote(`↗ ${a.label} launched${item.branch ? ` · ${item.branch}` : ""}`)
      setTimeout(onBack, 900)
    } catch (e) {
      setNote(`✗ ${(e as Error).message}`)
    }
  }

  useInput((input, key) => {
    if (key.escape || input === "q") {
      if (step === "place") {
        setStep("agent")
        setCursor(0)
        return
      }
      return onBack()
    }
    if (key.return) {
      if (step === "agent") {
        setAgent((agents ?? [])[safeCursor] ?? null)
        setStep("place")
        setCursor(0)
      } else if (agent) {
        void launch(agent, PLACEMENTS[safeCursor].id)
      }
    }
  })

  return (
    <DrillView
      title={`Run AI · #${item.number} · ${item.repo}`}
      subtitle={
        step === "agent" ? "choose an agent" : `${agent?.label} — choose where`
      }
      hints={[
        ["↑↓", "nav"],
        ["↵", step === "agent" ? "choose" : "launch"],
        ["q/esc", step === "place" ? "back" : "close"],
      ]}
    >
      {!agents ? (
        <Text color={colors.info}>Detecting agents…</Text>
      ) : (
        <Box flexDirection="column">
          {list.map((row, i) => (
            <Box key={row.label}>
              <Text color={colors.info}>
                {i === safeCursor ? "  ❯ " : "    "}
              </Text>
              <Text bold={i === safeCursor}>{row.label}</Text>
              {row.hint ? <Text dimColor>{"  " + row.hint}</Text> : null}
            </Box>
          ))}
          {prompt ? (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>{`prompt  ${prompt}`}</Text>
              {focused && focused.cmd && !focused.acceptsPrompt ? (
                <Text
                  dimColor
                >{`        ${focused.label} takes no prompt — starts cold`}</Text>
              ) : null}
            </Box>
          ) : null}
          {note ? (
            <Box marginTop={1}>
              <Text color={colors.success}>{note}</Text>
            </Box>
          ) : null}
        </Box>
      )}
    </DrillView>
  )
}
