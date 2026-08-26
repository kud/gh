import { $ } from "zx"
import React, { useState } from "react"
import { Box, useInput } from "ink"
import { Tabs, useTabs, type TabItem } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"
import { ActionMenu, buildActions, useActionMenu, type GHItem } from "../lib.js"
import { HealthPanel } from "@kud/gh-ink"
import { fetchHealth, type PrCheck } from "@kud/gh"
import { CommentsPanel, fetchComments } from "./comments-panel.js"
import { CheckLogView, jobIdOf } from "./check-log-view.js"
import { checkDrillFor } from "./check-drill.js"
import { AiLauncher, CopyPromptNotice, seedPromptFor } from "./ai-panel.js"
import { FilePicker } from "./file-picker.js"
import { useCachedResource } from "./cache.js"

type Tab = "health" | "conversation"

// Where an activated check drills to — a GitHub Actions job log or a Jenkins
// build console. Derived here (cockpit-specific routing) from the check the
// shared, UI-only HealthPanel reports via onOpenCheck.
type LogTarget = { repo: string; jobId: string; name: string; url: string }

// The unified PR drill: a focused CLI mirror of the GitHub PR page minus the
// diff (that's in the local branch). Two view-tabs — Health (CI + reviews +
// merge) and Comments (conversation + review threads). AI is an *action* (a),
// not a tab: it opens a launcher overlay to run an agent on this branch.
// Only the active panel is mounted, so input never crosses between tabs; the
// check log and AI launcher mount over everything as sub-views.
export const PrView = ({
  item,
  login,
  onBack,
  defaultTab,
  onRefresh,
  onRemove,
  onMerged,
}: {
  // The full row, not a structural subset: the action menu is built from the
  // same item the inbox builds it from, so a narrower shape here would mean
  // maintaining two ideas of what a PR row is.
  item: GHItem
  login: string
  onBack: () => void
  defaultTab?: Tab
  onRefresh?: () => void
  onRemove?: (item: GHItem) => void
  // Distinct from onRemove: the shell holds the row on screen, marked MERGED,
  // before dropping it. Optional all the way down, so a merge still works if the
  // shell never wired one — HealthPanel falls back to reloading, as it always did.
  onMerged?: (item: GHItem) => void
}) => {
  const [log, setLog] = useState<LogTarget | null>(null)
  const [ai, setAi] = useState(false)
  const [files, setFiles] = useState(false)
  const [copy, setCopy] = useState(false)
  const [replying, setReplying] = useState(false)
  const menu = useActionMenu()

  // The fetch lives here (not in CommentsPanel) so the Comments tab label can
  // carry the counts — the conversation total and unresolved-thread count —
  // reconciling the glance row's "N unresolved" with what you land on.
  const comments = useCachedResource(
    `pr-comments-${item.repo}-${item.number}`,
    () => fetchComments(item.repo, item.number, "pr"),
  )
  // Only the unresolved count. The panel prints its own "Conversation (N)"
  // heading two lines below, so carrying the plain total here stacks the same
  // number twice; unresolved is the one signal the heading does not repeat, and
  // the one worth seeing from the Health tab.
  const unresolvedCount = (comments.data?.threads ?? []).filter(
    (t) => !t.isResolved,
  ).length
  const conversationLabel = unresolvedCount
    ? `Conversation (${unresolvedCount} unresolved)`
    : "Conversation"

  const tabItems: TabItem<Tab>[] = [
    { value: "health", label: "Health" },
    { value: "conversation", label: conversationLabel },
  ]

  // Focus gate shared by useTabs and the view's own keymap, so Tab can't switch
  // tabs underneath a mounted sub-view.
  const inputActive = log === null && !ai && !files && !replying && !copy
  // The menu replaces the active panel rather than floating over it, so the
  // panel is unmounted and cannot compete for arrow keys while it is up. Tab
  // switching is suspended for the same reason.
  const menuOpen = menu.actions !== null

  // useTabs binds Tab/Shift+Tab only — the ←→ binding below is not redundant
  // with it, and removing it drops arrow navigation entirely.
  const { active, setActive } = useTabs(tabItems, {
    initial: defaultTab ?? "health",
    isActive: inputActive && !menuOpen,
  })
  const tab = active ?? "health"

  // Health fetch lifted here (like comments) now that the panel is UI-only.
  const health = useCachedResource(
    `pr-health-${item.repo}-${item.number}`,
    () => fetchHealth(item.repo, item.number),
  )

  const checkLabel = (c: PrCheck) =>
    c.workflowName
      ? `${c.workflowName} / ${c.context ?? c.name}`
      : (c.context ?? c.name ?? "")

  // Route an activated check: a GitHub Actions or Jenkins check with a drillable
  // log opens an in-terminal log view; anything else opens in the browser.
  const onOpenCheck = (c: PrCheck) => {
    const url = c.detailsUrl ?? c.targetUrl ?? ""
    const jobId = jobIdOf(url)
    // A GitHub Actions job drills to its log; anything else drills only if a
    // host registered a viewer for it. An unrecognised CI system opens in a
    // browser, which beats a drill-in that renders nothing.
    if (jobId || checkDrillFor(url))
      setLog({ repo: item.repo, jobId: jobId ?? "", name: checkLabel(c), url })
    else if (url) $`open ${url}`.catch(() => {})
  }

  useInput(
    (input, key) => {
      if (menu.handleKey(key)) return
      if (key.escape || input === "q") return onBack()
      // `M`, not `m`: HealthPanel owns lowercase `m` for merge on this screen.
      // Same mnemonic as the inbox's `m`, one shift away, and both are safe to
      // hit by mistake — the menu is inert until you pick something, and merge
      // asks for confirmation.
      if (input === "M") {
        menu.open([
          ...buildActions(
            item,
            login,
            () => {},
            undefined,
            undefined,
            undefined,
            onRefresh,
            // onRemove navigates back itself, having stripped the row. Calling
            // onBack() as well would re-set state from a closure captured
            // before the removal, putting the row straight back.
            (removed) => (onRemove ? onRemove(removed) : onBack()),
          ),
          // Appended here rather than via gh-ink's extension seam: on this screen
          // the launcher is mounted directly by `a` below, not opened as an overlay
          // through onOpenExt, so there is no extension for buildActions to list.
          // The browse screen gets the same entry the other way, from delegate's
          // scope: "item" — same action, two hosts, two routes to it.
          {
            label: "Delegate to an agent",
            hint: "a",
            run: () => setAi(true),
          },
          {
            label: "Copy prompt to clipboard",
            hint: "y",
            run: () => setCopy(true),
          },
        ])
        return
      }
      if (input === "o") {
        $`open ${item.url}`.catch(() => {})
        return
      }
      if (input === "a") {
        setAi(true)
        return
      }
      if (input === "y") {
        setCopy(true)
        return
      }
      if (input === "e") {
        setFiles(true)
        return
      }
      if (key.leftArrow || key.rightArrow)
        setActive((t) => (t === "health" ? "conversation" : "health"))
    },
    { isActive: inputActive },
  )

  if (files)
    return (
      <FilePicker
        repo={item.repo}
        number={item.number}
        onBack={() => setFiles(false)}
      />
    )

  if (ai)
    return (
      <AiLauncher
        item={item}
        login={login}
        prompt={seedPromptFor(item)}
        onBack={() => setAi(false)}
      />
    )

  if (copy)
    return <CopyPromptNotice item={item} onBack={() => setCopy(false)} />

  if (log) {
    // A host-registered viewer wins where one matches; otherwise this is a
    // GitHub Actions job and drills to its log. Both mount over the PR view and
    // hand focus back on esc.
    const drill = checkDrillFor(log.url)
    return drill ? (
      <>
        {drill.render({
          repo: log.repo,
          url: log.url,
          name: log.name,
          onBack: () => setLog(null),
        })}
      </>
    ) : (
      <CheckLogView
        repo={log.repo}
        jobId={log.jobId}
        name={log.name}
        url={log.url}
        onBack={() => setLog(null)}
      />
    )
  }

  const hints: [string, string][] =
    tab === "health"
      ? [
          ["↑↓", "nav"],
          ["↵/l", "log"],
          ["r", "retrigger"],
          ["m", "merge"],
          ["a", "AI"],
          ["y", "copy prompt"],
          ["e", "files"],
          ["M", "actions"],
          ["←→", "tab"],
          ["o", "open PR"],
          ["q", "back"],
        ]
      : [
          ["↑↓", "thread"],
          ["x", "resolve"],
          ["r", "reply"],
          ["R", "show resolved"],
          ["M", "actions"],
          ["a", "AI"],
          ["y", "copy prompt"],
          ["←→", "tab"],
          ["q", "back"],
        ]

  return (
    <DrillView
      title={`#${item.number} · ${item.repo}`}
      subtitle={item.title}
      hints={hints}
    >
      <Box marginBottom={1}>
        <Tabs active={tab} items={tabItems} />
      </Box>
      {menu.actions ? (
        <ActionMenu item={item} actions={menu.actions} cursor={menu.cursor} />
      ) : tab === "health" ? (
        <HealthPanel
          repo={item.repo}
          number={item.number}
          data={health.data}
          error={health.error}
          reload={health.reload}
          onOpenCheck={onOpenCheck}
          onMerged={onMerged ? () => onMerged(item) : undefined}
        />
      ) : (
        <CommentsPanel
          repo={item.repo}
          number={item.number}
          data={comments.data}
          error={comments.error}
          reload={comments.reload}
          onReplyingChange={setReplying}
          showConversationHeading={false}
        />
      )}
    </DrillView>
  )
}
