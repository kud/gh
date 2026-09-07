import { $ } from "zx"
import React, { useState, useEffect } from "react"
import { useInput } from "ink"
import { colors, ScrollView, type StyledLine } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"

// GitHub Actions check detailsUrl → job id (…/actions/runs/N/job/M) so we can
// pull the raw job log for the in-terminal drill.
export const jobIdOf = (url: string | null | undefined): string | null =>
  url?.match(/\/job\/(\d+)/)?.[1] ?? null

const stripTimestamp = (line: string): string =>
  line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, "").replace(/\s+$/, "")

const colorFor = (clean: string): string | undefined => {
  const lower = clean.toLowerCase()
  if (/(^|\W)(error|fail(ed|ure)?)\b/.test(lower)) return colors.error
  if (/(^|\W)warn(ing)?\b/.test(lower)) return colors.warning
  return undefined
}

// GitHub Actions logs are mostly runner boilerplate; the failure is buried at
// the end. Strip the ##[...] workflow-command noise, dim setup groups, surface
// errors/warnings, and remember the first ##[error] so the view can open there.
const processLog = (raw: string[]): { lines: StyledLine[]; jumpTo: number } => {
  const lines: StyledLine[] = []
  let firstError = -1
  for (const l of raw) {
    const clean = stripTimestamp(l)
    const cmd = clean.match(/^##\[(\w+)\](.*)$/)
    if (cmd) {
      const [, kind, rest] = cmd
      if (kind === "endgroup") continue
      if (kind === "group") {
        lines.push({ text: "▸ " + rest, dim: true, bold: true })
      } else if (kind === "error") {
        if (firstError < 0) firstError = lines.length
        lines.push({ text: rest, color: colors.error })
      } else if (kind === "warning") {
        lines.push({ text: rest, color: colors.warning })
      } else {
        lines.push({ text: rest, dim: true }) // command / section / debug
      }
      continue
    }
    lines.push({ text: clean, color: colorFor(clean) })
  }
  // Open on the failure (a few lines of context above), else on the tail.
  const jumpTo =
    firstError >= 0
      ? Math.max(0, firstError - 3)
      : Math.max(0, lines.length - 1)
  return { lines, jumpTo }
}

/**
 * Everything a terminal would act on, removed before the log is drawn.
 *
 * A CI log is written BY programs that colour their own output, so most of them
 * arrive full of escape sequences — this is the normal case, not an edge. Two
 * separate reasons they cannot reach the frame:
 *
 * `gh` refuses to print them at all without `--allow-escape-sequences`, which is
 * a sensible default for a CLI whose output might be piped anywhere; and once
 * allowed through, they are still someone else's styling arriving inside a view
 * that does its own. A `\x1b[2J` in a build log would clear the frame around it.
 *
 * The pattern covers CSI sequences and OSC strings (`\x1b]8;;…` hyperlinks are
 * common in modern build tools) — the two forms that carry a terminator rather
 * than a fixed length.
 */
export const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
export const stripAnsi = (s: string): string => s.replace(ANSI, "")

// Mounted view of a GitHub Actions job log — reached from the checks list /
// health panel. Fetches the raw log via `gh api`, windows it with ScrollView.
export const CheckLogView = ({
  repo,
  jobId,
  name,
  url,
  onBack,
}: {
  repo: string
  jobId: string
  name: string
  url: string | null | undefined
  onBack: () => void
}) => {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; lines: string[] }
  >({ phase: "loading" })

  useEffect(() => {
    let live = true
    // `--allow-escape-sequences` or `gh` exits 1 on any log carrying colour,
    // which is most of them: "the response contains terminal escape sequences".
    // Asking for them and then stripping them is not a contradiction — the flag
    // is `gh` declining to decide on our behalf, and stripping is us deciding.
    $`gh api --allow-escape-sequences repos/${repo}/actions/jobs/${jobId}/logs`
      .quiet()
      .then(
        (r) =>
          live &&
          setState({
            phase: "ready",
            lines: stripAnsi(r.stdout).split("\n"),
          }),
      )
      .catch(
        (e) =>
          live && setState({ phase: "error", message: (e as Error).message }),
      )
    return () => {
      live = false
    }
  }, [repo, jobId])

  useInput((input, key) => {
    if (key.escape || input === "q") return onBack()
    if (input === "o" && url) $`open ${url}`.catch(() => {})
  })

  let lines: StyledLine[] = []
  let jumpTo = 0
  if (state.phase === "loading")
    lines = [{ text: "Fetching log…", color: colors.info }]
  else if (state.phase === "error")
    lines = [{ text: `Error: ${state.message}`, color: colors.error }]
  else ({ lines, jumpTo } = processLog(state.lines))

  return (
    <DrillView
      title={`${name}  — log`}
      subtitle={
        state.phase === "ready" ? `${state.lines.length} lines` : undefined
      }
      hints={[
        ["↑↓/space", "scroll"],
        ["g/G", "top/tail"],
        ["o", "open"],
        ["q/esc", "back"],
      ]}
    >
      <ScrollView lines={lines} initialStart={jumpTo} />
    </DrillView>
  )
}
