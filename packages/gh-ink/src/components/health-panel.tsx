import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { colors } from "@kud/ink-ui"
import {
  isFailCheck,
  isPassCheck,
  mergePr,
  reRequestReviewer,
  rerunFailedRun,
  type PrCheck,
  type PrHealthData,
} from "@kud/gh"

const checkIcon = (c: PrCheck): [string, string] =>
  isPassCheck(c)
    ? ["✓", colors.success]
    : isFailCheck(c)
      ? ["✗", colors.error]
      : ["·", colors.warning]

const checkLabel = (c: PrCheck) => {
  const name = c.context ?? c.name ?? ""
  return c.workflowName ? `${c.workflowName} / ${name}` : name
}
const checkUrl = (c: PrCheck) => c.detailsUrl ?? c.targetUrl ?? ""
const runIdOf = (url: string): string | null =>
  url.match(/\/runs\/(\d+)/)?.[1] ?? null

const reviewIcon = (state: string): [string, string] =>
  state === "APPROVED"
    ? ["✓", colors.success]
    : state === "CHANGES_REQUESTED"
      ? ["~", colors.warning]
      : ["·", colors.muted]

const MERGE: Record<string, [string, string]> = {
  CLEAN: ["ready", colors.success],
  BLOCKED: ["blocked", colors.error],
  DIRTY: ["has conflicts", colors.error],
  UNSTABLE: ["unstable", colors.warning],
  BEHIND: ["behind base", colors.warning],
}
const mergeText = (status: string): [string, string] =>
  MERGE[status] ?? ["checking…", colors.warning]

const Summary = ({
  label,
  icon,
  parts,
}: {
  label: string
  icon: string
  parts: [string, string][]
}) => (
  <Box>
    <Text>{"  "}</Text>
    <Text bold>{label.padEnd(10)}</Text>
    <Text>{icon + "  "}</Text>
    {parts.map(([text, color], i) => (
      <React.Fragment key={text + i}>
        {i > 0 && <Text dimColor>{" · "}</Text>}
        <Text color={color as any}>{text}</Text>
      </React.Fragment>
    ))}
  </Box>
)

export type HealthPanelProps = {
  repo: string
  number: number
  data: PrHealthData | null
  error: string | null
  reload: () => void
  // Fired when a check is activated (↵/l). The consumer decides what "open"
  // means — drill into an in-terminal log, or open the check's url in a browser.
  onOpenCheck: (check: PrCheck) => void
}

// Content-only PR health panel (the consuming surface owns any chrome and the
// fetch): CI checks + reviews + merge status, the focused CLI mirror of the
// GitHub PR page minus the diff. `r` re-runs failed CI, `m` merges (with
// confirm), ↵/l activates a check (→ onOpenCheck) or re-requests a reviewer.
// Actions run against @kud/gh and call `reload` to refetch.
export const HealthPanel = ({
  repo,
  number,
  data,
  error,
  reload,
  onOpenCheck,
}: HealthPanelProps) => {
  const [cursor, setCursor] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<"merge" | null>(null)
  const [busy, setBusy] = useState(false)

  const checks = (data?.statusCheckRollup ?? []).filter((c) =>
    (c.name ?? c.context)?.trim(),
  )
  const reviewers: [string, string][] = data
    ? Object.entries(
        data.reviews.reduce<Record<string, string>>(
          (acc, r) =>
            r.author?.login && r.author.login !== data.author?.login
              ? { ...acc, [r.author.login]: r.state }
              : acc,
          {},
        ),
      )
    : []
  const focusCount = checks.length + reviewers.length
  const safeCursor = Math.min(cursor, Math.max(0, focusCount - 1))
  const selected = safeCursor < checks.length ? checks[safeCursor] : undefined
  const selectedReviewer =
    safeCursor >= checks.length
      ? reviewers[safeCursor - checks.length]
      : undefined

  const flash = (msg: string) => {
    setNote(msg)
    setTimeout(() => setNote(null), 2500)
  }

  const act = async (msg: string, run: () => Promise<unknown>) => {
    setBusy(true)
    setNote(`⋯ ${msg}…`)
    try {
      await run()
      flash(`✓ ${msg}`)
      reload()
    } catch {
      flash(`✗ ${msg} failed`)
    } finally {
      setBusy(false)
    }
  }

  const retrigger = () => {
    const failing = checks.find((c) => isFailCheck(c) && runIdOf(checkUrl(c)))
    const runId = failing && runIdOf(checkUrl(failing))
    if (!runId) return flash("No failed Actions run to retrigger")
    void act("retrigger CI", () => rerunFailedRun(repo, runId))
  }

  useInput((input, key) => {
    if (busy) return
    if (confirm === "merge") {
      if (input === "y" || input === "Y")
        void act("merge", () => mergePr(repo, number))
      setConfirm(null)
      return
    }
    if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === "j")
      setCursor((c) => Math.min(Math.max(0, focusCount - 1), c + 1))
    if (input === "r") return retrigger()
    if (input === "m") return void setConfirm("merge")
    if (key.return || input === "l") {
      if (selected) onOpenCheck(selected)
      else if (selectedReviewer) {
        const login = selectedReviewer[0]
        void act(`re-request ${login}`, () =>
          reRequestReviewer(repo, number, login),
        )
      }
    }
  })

  if (error) return <Text color={colors.error}>Error: {error}</Text>
  if (!data) return <Text color={colors.info}>Fetching status…</Text>

  const reviewerMap = Object.fromEntries(reviewers)
  const passed = checks.filter(isPassCheck).length
  const failed = checks.filter(isFailCheck).length
  const pending = checks.length - passed - failed
  const approved = Object.values(reviewerMap).filter(
    (s) => s === "APPROVED",
  ).length
  const changesReq = Object.values(reviewerMap).filter(
    (s) => s === "CHANGES_REQUESTED",
  ).length

  const checkParts: [string, string][] = [[`${passed} passed`, colors.success]]
  if (failed > 0) checkParts.push([`${failed} failed`, colors.error])
  if (pending > 0) checkParts.push([`${pending} pending`, colors.warning])

  const reviewParts: [string, string][] = [
    approved > 0
      ? [`${approved} approved`, colors.success]
      : ["0 approved", "white"],
  ]
  if (changesReq > 0)
    reviewParts.push([`${changesReq} changes requested`, colors.error])
  if (data.reviewDecision === "REVIEW_REQUIRED")
    reviewParts.push(["review required", colors.warning])

  const [mText, mColor] = mergeText(data.mergeStateStatus)
  const checksIcon = failed > 0 ? "✗" : pending > 0 ? "·" : "✓"
  const reviewsIcon = changesReq > 0 ? "✗" : approved > 0 ? "✓" : "·"
  const mergeIcon = data.mergeStateStatus === "CLEAN" ? "✓" : "·"

  return (
    <Box flexDirection="column">
      <Summary label="Checks" icon={checksIcon} parts={checkParts} />
      <Box flexDirection="column">
        {checks.map((c, i) => {
          const [icon, color] = checkIcon(c)
          return (
            <Box key={checkLabel(c) + i}>
              <Text color={colors.info}>
                {i === safeCursor ? "  ❯ " : "    "}
              </Text>
              <Text color={color as any}>{icon + " "}</Text>
              <Text bold={i === safeCursor}>{checkLabel(c)}</Text>
              {i === safeCursor ? <Text dimColor>{"  ↵ open"}</Text> : null}
            </Box>
          )
        })}
      </Box>

      <Box marginTop={checks.length ? 1 : 0}>
        <Summary label="Reviews" icon={reviewsIcon} parts={reviewParts} />
      </Box>
      {reviewers.map(([login, state], j) => {
        const [icon, color] = reviewIcon(state)
        const active = safeCursor === checks.length + j
        return (
          <Box key={login}>
            <Text color={colors.info}>{active ? "  ❯ " : "    "}</Text>
            <Text color={color as any}>{icon + " "}</Text>
            <Text bold={active}>{login}</Text>
            {active ? <Text dimColor>{"  ↵ re-request"}</Text> : null}
          </Box>
        )
      })}

      <Box marginTop={reviewers.length ? 1 : 0}>
        <Summary label="Merge" icon={mergeIcon} parts={[[mText, mColor]]} />
      </Box>

      {confirm === "merge" ? (
        <Box marginTop={1}>
          <Text color={colors.warning}>
            {`  Merge #${number}?  `}
            <Text color={colors.success}>y</Text>
            <Text dimColor> confirm · any other key cancels</Text>
          </Text>
        </Box>
      ) : note ? (
        <Box marginTop={1}>
          <Text color={colors.success}>{"  " + note}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
