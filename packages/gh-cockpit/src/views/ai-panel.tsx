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
import { portablePromptFor, type PromptContext } from "../prompts.js"

type Agent = {
  id: string
  label: string
  cmd: string
  /**
   * Whether the binary takes a prompt as its positional argument. A fact about
   * the COMMAND, true for every install — not about whether the prompt makes
   * sense to it, which is a different question the seed no longer raises.
   */
  acceptsPrompt?: boolean
}
type Placement = "here" | "tab" | "vpane" | "hpane"

/**
 * AI agents we know how to launch — only those actually on PATH are offered.
 *
 * `acceptsPrompt` is per-agent because a seeded prompt is not a uniform trailing
 * argument. `claude [prompt]` and `codex [PROMPT]` take one and stay
 * interactive; opencode's positional is `[project]`, a path, so appending a
 * prompt makes it try to start in a directory called "Review the pull request…".
 * Its message form, `opencode run`, is headless, which throws away the
 * conversation this handoff exists to open. So opencode launches cold-started,
 * and the UI says so rather than silently dropping the seed.
 *
 * WHAT THIS FLAG DOES NOT MEAN, learned the hard way. It answers "does the
 * binary take a positional prompt", never "will the prompt mean anything once it
 * arrives". Those came apart when the seed was a Claude Code slash command:
 * Codex passed the flag, was handed `/k-pr 733`, and opened on a string it could
 * not resolve — failing inside the agent, minutes later, with nothing here
 * looking wrong.
 *
 * The seed is plain prose now (see DEFAULT_SEED in prompts.ts), which is what
 * makes this table safe to keep general. A sentence carrying a URL needs no
 * command vocabulary, so there is nothing left for an agent to fail to
 * understand, and every install can be offered every agent it actually has.
 *
 * Narrowing this list to one agent is therefore the wrong repair: it would bake
 * one host's vocabulary into a published package, which is the mistake
 * `prompts.ts` was written to undo, made again from the other end.
 */
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

// The no-launch half of delegation: put the prompt on the clipboard for a session
// that is already warm elsewhere, rather than starting a cold one. Shows the exact
// text instead of a bare "copied" — it is about to be pasted somewhere with no
// other context, so reading it before it goes is the point — then dismisses
// itself; any key dismisses it sooner.
export const CopyPromptNotice = ({
  item,
  onBack,
}: {
  item: PromptContext
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
      // Every agent in CANDIDATES understands the seed by construction, so the
      // only thing left to check is whether there is a command to hand it to —
      // "Shell (no AI)" carries an empty `cmd` and takes you to the checkout.
      const run = prompt && a.cmd ? `${a.cmd} ${shellQuote(prompt)}` : a.cmd
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
          {/* Shown only where it will actually be used. It used to render
              unconditionally and then apologise underneath — "opencode takes no
              prompt — starts cold" — which put a value and its retraction on
              screen at the same dim weight, so the line that mattered was the
              one styled as skippable. A seed that is not going to be sent is
              simply not drawn. */}
          {prompt && focused?.cmd ? (
            <Box marginTop={1}>
              <Text dimColor>{`prompt  ${prompt}`}</Text>
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
