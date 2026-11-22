import React, { useRef, useState } from "react"
import { Box, Text, useInput } from "ink"
import { colors } from "@kud/ink-ui"
import {
  isFailCheck,
  isInconclusiveCheck,
  isPassCheck,
  mergePr,
  reRequestReviewer,
  rerunFailedRun,
  type PrCheck,
  type PrHealthData,
} from "@kud/gh"

// Four glyphs, never three: a check that was cancelled and one that is still
// running are both "not green", and collapsing them lost the only fact that
// tells you whether waiting will help. kud is colourblind, so the shape has to
// carry it — `-` reads as finished with no result, `◌` as not yet.
//
// `·` was the not-yet glyph until 2026-11-22, and it was also the separator in
// every summary line two rows up — `4 passed · 1 failed` — so the one mark that
// meant "keep waiting" was the same dot the eye had learnt to skip. It is a
// separator only now, here and in the summaries, and `◌` is an empty slot that
// something is still on its way to fill.
//
// SKIPPED and NEUTRAL take `-` although `isPassCheck` counts them as passing,
// and that split is deliberate: the classifier answers "does this block the
// PR?", which they do not, and must keep answering it for `computeHealth` and
// the whose-move bands. The glyph answers "what did this check find?", and a
// skipped job found nothing. A green ✓ beside a job that never ran was the
// panel claiming a verdict nobody reached — the same over-claim that moved
// CANCELLED out of the fail set, pointing the other way. Hence the display-only
// predicate below rather than an edit to the classifier.
const isNoVerdictPass = (c: PrCheck): boolean =>
  ["SKIPPED", "NEUTRAL"].includes(c.conclusion ?? "")

const checkIcon = (c: PrCheck): [string, string] =>
  isFailCheck(c)
    ? ["✗", colors.error]
    : isInconclusiveCheck(c)
      ? ["-", colors.warning]
      : isNoVerdictPass(c)
        ? ["-", colors.muted]
        : isPassCheck(c)
          ? ["✓", colors.success]
          : ["◌", colors.warning]

/**
 * Where a check sorts in the list: worst first, so the row you came to the
 * panel for is the row the cursor opens on. Failures, then the runs that ended
 * asking for a person (cancelled, stale, ACTION_REQUIRED — which `isFailCheck`
 * counts as a failure for the band, but which is a gate waiting on a click, not
 * a verdict on the code, so it sorts beside the other runs worth a retrigger),
 * then what is still running, then what finished without a verdict, then the
 * passes. Every row is still drawn: a pass folded out of sight is a pass you
 * cannot open, and a list that changes length with its contents moves the
 * cursor under your finger.
 */
export const checkRank = (c: PrCheck): number =>
  c.conclusion === "ACTION_REQUIRED"
    ? 1
    : isFailCheck(c)
      ? 0
      : isInconclusiveCheck(c)
        ? 1
        : isNoVerdictPass(c)
          ? 3
          : isPassCheck(c)
            ? 4
            : 2

/** Stable within a rank, so GitHub's own order survives as the tie-break. */
export const orderChecks = (checks: PrCheck[]): PrCheck[] =>
  checks
    .map((c, i) => [c, i] as const)
    .sort(([a, i], [b, j]) => checkRank(a) - checkRank(b) || i - j)
    .map(([c]) => c)

/**
 * The mark beside "Checks". It used to be `✓` whenever nothing had failed and
 * nothing was running, which drew a green tick over a list in which every run
 * had been cancelled: `✓  0 passed · 3 cancelled`. A tick has to be earned by a
 * pass, so a cancelled run — or a list with no pass in it at all — gets `-`.
 */
export const checksMark = (counts: {
  passed: number
  failed: number
  cancelled: number
  pending: number
}): [string, string] =>
  counts.failed > 0
    ? ["✗", colors.error]
    : counts.pending > 0
      ? ["◌", colors.warning]
      : counts.cancelled > 0
        ? ["-", colors.warning]
        : counts.passed === 0
          ? ["-", colors.muted]
          : ["✓", colors.success]

const checkLabel = (c: PrCheck) => {
  const name = c.context ?? c.name ?? ""
  return c.workflowName ? `${c.workflowName} / ${name}` : name
}
const checkUrl = (c: PrCheck) => c.detailsUrl ?? c.targetUrl ?? ""
const runIdOf = (url: string): string | null =>
  url.match(/\/runs\/(\d+)/)?.[1] ?? null

// A comment is a review that finished without a verdict, so it takes the same
// `-` a skipped check does; a review still in draft is not finished, so `◌`.
const reviewIcon = (state: string): [string, string] =>
  state === "APPROVED"
    ? ["✓", colors.success]
    : state === "CHANGES_REQUESTED"
      ? ["~", colors.warning]
      : state === "PENDING"
        ? ["◌", colors.muted]
        : ["-", colors.muted]

const MERGE: Record<string, [string, string]> = {
  CLEAN: ["ready", colors.success],
  BLOCKED: ["blocked", colors.error],
  DIRTY: ["has conflicts", colors.error],
  UNSTABLE: ["unstable", colors.warning],
  BEHIND: ["behind base", colors.warning],
}
const mergeText = (status: string): [string, string] =>
  MERGE[status] ?? ["checking…", colors.warning]
// The merge mark, in the colour of the words beside it: a tick only when GitHub
// says the PR can land, a cross where it says it cannot, and `◌` for the states
// that resolve by waiting or by a push — behind, unstable, still computing.
const mergeMark = (status: string): [string, string] => {
  const [, color] = mergeText(status)
  return status === "CLEAN"
    ? ["✓", color]
    : status === "BLOCKED" || status === "DIRTY"
      ? ["✗", color]
      : ["◌", color]
}

const Summary = ({
  label,
  mark: [icon, iconColor],
  parts,
}: {
  label: string
  mark: [string, string]
  parts: [string, string][]
}) => (
  <Box>
    <Text>{"  "}</Text>
    <Text bold>{label.padEnd(10)}</Text>
    <Text color={iconColor as any}>{icon}</Text>
    <Text>{"  "}</Text>
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
  // Fired once a merge has actually landed. Optional: a surface that only reads
  // health has nothing to do with it, and the panel still merges without one.
  onMerged?: () => void
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
  onMerged,
}: HealthPanelProps) => {
  const [cursor, setCursor] = useState(0)
  // The note carries its own colour. It was always drawn in the success green,
  // so `✗ merge failed` arrived in the colour of a merge that landed — and for
  // a colourblind reader the green was the only part of the line that had not
  // been read yet when the eye moved on.
  const [note, setNote] = useState<{ text: string; color: string } | null>(
    null,
  )
  const [confirm, setConfirm] = useState<"merge" | null>(null)
  const [busy, setBusy] = useState(false)

  const checks = orderChecks(
    (data?.statusCheckRollup ?? []).filter((c) => (c.name ?? c.context)?.trim()),
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

  // Same tempo as the inbox flash, and the same reason to clear the old timer:
  // see showFlash in inbox.tsx.
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = (text: string, color: string) => {
    setNote({ text, color })
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), 1500)
  }

  const act = async (
    msg: string,
    run: () => Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    setBusy(true)
    setNote({ text: `⋯ ${msg}…`, color: colors.info })
    try {
      await run()
      flash(`✓ ${msg}`, colors.success)
      // A handler that navigates away REPLACES the reload rather than racing it.
      // Refetching a PR whose panel is about to unmount spends a request to learn
      // what we already know, and lands its setState on a dead component.
      if (onSuccess) onSuccess()
      else reload()
    } catch {
      flash(`✗ ${msg} failed`, colors.error)
    } finally {
      setBusy(false)
    }
  }

  // Fail OR inconclusive, and the second half is the reason this action exists
  // at all for the case that prompted it: a job killed after six hours waiting
  // for a runner is precisely the one worth asking for again. Narrowing this to
  // isFailCheck when CANCELLED moved out of that set would have removed the fix
  // along with the false alarm.
  const retrigger = () => {
    const stuck = checks.find(
      (c) => (isFailCheck(c) || isInconclusiveCheck(c)) && runIdOf(checkUrl(c)),
    )
    const runId = stuck && runIdOf(checkUrl(stuck))
    if (!runId) return flash("No Actions run to retrigger", colors.warning)
    void act("retrigger CI", () => rerunFailedRun(repo, runId))
  }

  useInput((input, key) => {
    if (busy) return
    if (confirm === "merge") {
      // Without an onMerged the third argument is undefined and act() reloads,
      // which is exactly what this did before — so a host that never wired the
      // celebration keeps the old behaviour rather than losing the refresh.
      if (input === "y" || input === "Y")
        void act("merge", () => mergePr(repo, number), onMerged)
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
  const skipped = checks.filter(isNoVerdictPass).length
  const passed = checks.filter(isPassCheck).length - skipped
  const failed = checks.filter(isFailCheck).length
  const stale = checks.filter(isInconclusiveCheck).length
  const pending = checks.length - passed - skipped - failed - stale
  const approved = Object.values(reviewerMap).filter(
    (s) => s === "APPROVED",
  ).length
  const changesReq = Object.values(reviewerMap).filter(
    (s) => s === "CHANGES_REQUESTED",
  ).length

  const checkParts: [string, string][] = [[`${passed} passed`, colors.success]]
  if (failed > 0) checkParts.push([`${failed} failed`, colors.error])
  if (stale > 0) checkParts.push([`${stale} cancelled`, colors.warning])
  if (pending > 0) checkParts.push([`${pending} pending`, colors.warning])
  if (skipped > 0) checkParts.push([`${skipped} skipped`, colors.muted])

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
  const checksIcon = checksMark({
    passed,
    failed,
    cancelled: stale,
    pending,
  })
  const reviewsIcon: [string, string] =
    changesReq > 0
      ? ["✗", colors.error]
      : approved > 0
        ? ["✓", colors.success]
        : [
            "◌",
            data.reviewDecision === "REVIEW_REQUIRED"
              ? colors.warning
              : colors.muted,
          ]

  // Merge leads. It is the question the panel is opened to answer — can this
  // land? — and it sat under two lists that grow with the PR, so on a busy one
  // it was the line most likely to be below the fold. The words are unchanged;
  // only the order is.
  return (
    <Box flexDirection="column">
      <Summary
        label="Merge"
        mark={mergeMark(data.mergeStateStatus)}
        parts={[[mText, mColor]]}
      />
      <Summary label="Checks" mark={checksIcon} parts={checkParts} />
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
        <Summary label="Reviews" mark={reviewsIcon} parts={reviewParts} />
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
          <Text color={note.color as any}>{"  " + note.text}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
