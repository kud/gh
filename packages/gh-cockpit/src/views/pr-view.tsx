import { $ } from "zx"
import { spawnSync } from "node:child_process"
import React, { useEffect, useRef, useState } from "react"
import { Box, Text, useInput, useStdin } from "ink"
import { colors, Tabs, TextInput, useTabs, type TabItem } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"
import { ActionMenu, buildActions, useActionMenu, type GHItem } from "../lib.js"
import { HealthPanel } from "@kud/gh-ink"
import { fetchDefaultBranch, fetchHealth, mergePr, type PrCheck } from "@kud/gh"
import { CommentsPanel, fetchComments } from "./comments-panel.js"
import {
  separatorBefore,
  sizePartsOf,
  summaryOf,
  type Summary,
} from "./pr-summary.js"
import { CheckLogView, jobIdOf } from "./check-log-view.js"
import { checkDrillFor } from "./check-drill.js"
import { DecisionBlock } from "./decision-block.js"
import { decisionHooks } from "../decision.js"
import { AiLauncher, CopyPromptNotice } from "./ai-panel.js"
import { seedPromptFor } from "../prompts.js"
import { FilePicker } from "./file-picker.js"
import { useCachedResource } from "./cache.js"

type Tab = "health" | "conversation"

// Where an activated check drills to — a GitHub Actions job log, or whatever a
// host registered through registerCheckDrills. Derived here from the check the
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
  registerPeel,
  onTyping,
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
  // `esc` and `backspace` are the app's, bound once at its root — this view
  // publishes what to close instead of binding them. See `DetailContext`.
  registerPeel?: (peel: (() => boolean) | null) => void
  onTyping?: (typing: boolean) => void
}) => {
  const [log, setLog] = useState<LogTarget | null>(null)
  const [ai, setAi] = useState(false)
  const [files, setFiles] = useState(false)
  const [copy, setCopy] = useState(false)
  const [replying, setReplying] = useState(false)
  // Decision keys (`c`/`m`/`X`/`R`/`d`), live only while `item.needsYou` is
  // set — see the keymap below. `confirm` holds a pending merge/close until a
  // human answers it; `note` is the one-line status for everything the keys do.
  const [answering, setAnswering] = useState(false)
  const [confirm, setConfirm] = useState<"merge" | "close" | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [paging, setPaging] = useState(false)
  const { setRawMode } = useStdin()
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
  const inputActive =
    log === null && !ai && !files && !replying && !copy && !answering
  // The menu replaces the active panel rather than floating over it, so the
  // panel is unmounted and cannot compete for arrow keys while it is up. Tab
  // switching is suspended for the same reason.
  const menuOpen = menu.actions !== null

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

  // The default branch is the ONE fact on this line that cannot ride along on
  // the health fetch: `gh pr view --json` has no field for it (checked on gh
  // 2.100.0 — it carries `baseRefName`, `headRefName`, `headRepository`,
  // `headRepositoryOwner`, `isCrossRepository` and nothing naming the default).
  // So it is a second call, keyed by REPO rather than by PR — which is what
  // makes it cheap: the cache paints the last answer instantly, the effect
  // revalidates behind it, and a repo that renames its default heals itself on
  // the next drill-in. Mounted beside the health fetch, so the two are
  // concurrent and this adds no wall clock.
  const defaultBranch = useCachedResource(
    `repo-default-branch-${item.repo}`,
    () => fetchDefaultBranch(item.repo),
  )

  // Off the health fetch, which already goes to `gh pr view` per PR on demand —
  // so the four extra field names ride along for nothing rather than costing a
  // second call. Absent while it loads, and the line simply is not drawn.
  const summary = summaryOf(
    item,
    health.data,
    process.stdout.columns ?? 80,
    defaultBranch.data ?? undefined,
  )
  const sizeParts = health.data ? sizePartsOf(health.data) : null

  // The line as cells, in fixed order, with the absent ones dropped — so the
  // renderer joins what survived instead of asking about each pair.
  const summaryCells: { key: string; text: string }[] = [
    { key: "size", text: summary.size },
    { key: "files", text: summary.files },
    { key: "draft", text: summary.draft },
    { key: "head", text: summary.head },
    { key: "base", text: summary.base },
    { key: "author", text: summary.author },
    { key: "opened", text: summary.opened },
  ].filter((c): c is { key: string; text: string } => !!c.text)

  /*
   * THE PEEL — this drill's own layers, innermost first. Returning `false` means
   * nothing of mine is open, at which point closing the whole drill is the
   * root's next layer out.
   *
   * `replying` is a GUARD rather than a behaviour: the root stands its keys down
   * while the reply box has focus, so this arm is unreachable today. It exists
   * so that if that wiring ever regresses, `esc` in a half-typed reply does
   * nothing instead of throwing the drill away with the text in it.
   *
   * The AI launcher gets to peel its own two-step first — agent → placement is
   * two screens, and backing out of the placement should not leave the launcher.
   */
  const aiPeel = useRef<(() => boolean) | null>(null)
  const peel = (): boolean => {
    if (answering) return (setAnswering(false), true)
    if (confirm !== null) return (setConfirm(null), true)
    if (menu.actions !== null) return (menu.close(), true)
    if (replying) return true
    if (log !== null) return (setLog(null), true)
    if (files) return (setFiles(false), true)
    if (ai) return aiPeel.current?.() ?? (setAi(false), true)
    if (copy) return (setCopy(false), true)
    return false
  }
  useEffect(() => {
    registerPeel?.(peel)
    return () => registerPeel?.(null)
  })
  useEffect(() => {
    onTyping?.(replying || answering)
  }, [replying, answering, onTyping])

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

  // The decision keys below are human keypresses only: no auto-trigger
  // anywhere. Each shells out through zx's `$` with `.quiet()` — never a raw
  // gh stderr line printed outside the frame — and reports on the `note` line.
  const doMerge = async () => {
    setNote("⋯ merging…")
    try {
      await mergePr(item.repo, item.number)
      setNote(null)
      if (onMerged) onMerged(item)
      else onRefresh?.()
    } catch (e) {
      setNote(`✗ merge failed: ${(e as Error).message}`)
    }
  }

  const doClose = async () => {
    setNote("⋯ closing…")
    try {
      await $`gh pr close ${item.number} --repo ${item.repo}`.quiet()
      setNote(null)
      if (onRemove) onRemove(item)
      else onBack()
    } catch (e) {
      setNote(`✗ close failed: ${(e as Error).message}`)
    }
  }

  // Health tab only (the Conversation tab's `R` belongs to CommentsPanel's
  // show-resolved). On a PR that is not a draft it does nothing but say so.
  const markReady = async () => {
    if (item.health !== "draft") {
      setNote("Not a draft — nothing to mark ready")
      return
    }
    setNote("⋯ marking ready…")
    try {
      await $`gh pr ready ${item.number} --repo ${item.repo}`.quiet()
      setNote(null)
      onRefresh?.()
    } catch (e) {
      setNote(`✗ ready failed: ${(e as Error).message}`)
    }
  }

  // Posts the answer as a comment, then hands follow-through to the host —
  // typically clearing its own decision label, whose name this package never
  // learns. See `decision.ts`.
  const submitAnswer = async (body: string) => {
    const text = body.trim()
    setAnswering(false)
    if (!text) return
    setNote("Posting…")
    try {
      await $`gh pr comment ${item.number} --repo ${item.repo} --body ${text}`.quiet()
      setNote("✓ Answered")
      await decisionHooks().answered?.({
        kind: "pr",
        repo: item.repo,
        number: item.number,
        url: item.url,
        labels: item.labels,
      })
    } catch (e) {
      setNote(`✗ ${(e as Error).message}`)
    }
  }

  // The diff in the viewer's pager, which owns the terminal while it runs.
  //
  // In an effect, after a frame saying so has been drawn, rather than straight
  // from the keypress: spawnSync blocks the event loop, so the frame before it
  // is the one left on screen, and the note changing back afterwards is what
  // makes Ink repaint at all — it writes only when its output differs, and an
  // identical frame after a cleared screen would leave the screen blank.
  //
  // Raw mode off for the pager's keys, and the alternate screen re-entered on
  // the way out: a pager such as less leaves it with `rmcup`, which drops the
  // terminal back to the main screen under a cockpit that drew in the
  // alternate one. Number and repo travel as positional args, never
  // interpolated into the shell string.
  useEffect(() => {
    if (!paging) return
    // A beat for Ink to flush the "opening" frame: it writes on a throttle, and
    // a blocking spawn straight after commit can beat it to the terminal.
    const timer = setTimeout(() => {
      setRawMode(false)
      spawnSync(
        "sh",
        [
          "-c",
          'gh pr diff "$0" --repo "$1" --color=always | ${PAGER:-less -R}',
          String(item.number),
          item.repo,
        ],
        { stdio: "inherit" },
      )
      process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H")
      setRawMode(true)
      setNote(null)
      setPaging(false)
    }, 50)
    return () => clearTimeout(timer)
  }, [paging])

  useInput(
    (input, key) => {
      if (menu.handleKey(key)) return
      // Decision keys live in the DRILL views only, never on inbox rows, and
      // only while the host marked this row as needing the viewer. A key never
      // changes meaning based on item state.
      if (item.needsYou) {
        // A pending confirm resolves on the next key: `y` goes ahead, anything
        // else — esc included — stands the question down.
        if (confirm === "merge") {
          if (input === "y" || input === "Y") void doMerge()
          setConfirm(null)
          return
        }
        if (confirm === "close") {
          if (input === "y" || input === "Y") void doClose()
          setConfirm(null)
          return
        }
        // `c` answers: a text box, posted as a comment, then the host's
        // "answered" hook. Free on every tab.
        if (input === "c") {
          setAnswering(true)
          return
        }
        // `d` shows the diff in the user's pager. PR only. Free on every tab.
        if (input === "d") {
          setNote("⋯ opening the diff in your pager…")
          setPaging(true)
          return
        }
        // `X` closes, with a confirm, on every tab.
        if (input === "X") {
          setConfirm("close")
          return
        }
        // `m` merges, with a confirm — on the Conversation tab only. On Health
        // the shared HealthPanel already owns `m` (merge with a `y` confirm),
        // so handling it here too would fire both on one keypress.
        if (input === "m" && tab === "conversation") {
          setConfirm("merge")
          return
        }
        // `R` marks a draft PR ready — on the Health tab only. Conversation
        // keeps `R` = show resolved, which CommentsPanel owns.
        if (input === "R" && tab === "health") {
          void markReady()
          return
        }
      }
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
            // An act on the row, grouped with the host's other acts — the menu
            // sorts by group, so appended rows still land in display order.
            group: "act",
            run: () => setAi(true),
          },
          {
            label: "Copy prompt to clipboard",
            hint: "y",
            group: "copy",
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
        peelRef={aiPeel}
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

  // Footer hints show the decision keys only when live: needsYou set, on the
  // tab where each applies. `m` is listed on Conversation alone, since Health
  // already lists the merge HealthPanel owns; `R` on Health alone, since
  // Conversation's `R` is CommentsPanel's show-resolved.
  const decisionHints: [string, string][] = !item.needsYou
    ? []
    : tab === "health"
      ? [
          ["c", "answer"],
          ["d", "diff"],
          ["X", "close"],
          ["R", "ready"],
        ]
      : [
          ["c", "answer"],
          ["d", "diff"],
          ["m", "merge"],
          ["X", "close"],
        ]

  const hints: [string, string][] =
    tab === "health"
      ? [
          ["↑↓", "nav"],
          ["↵/l", "log"],
          ["r", "retrigger"],
          ["m", "merge"],
          ...decisionHints,
          ["a", "AI"],
          ["y", "copy prompt"],
          ["e", "files"],
          ["M", "actions"],
          ["←→", "tab"],
          ["o", "open PR"],
          ["esc", "back"],
        ]
      : [
          ["↑↓", "thread"],
          ["x", "resolve"],
          ["r", "reply"],
          ["R", "show resolved"],
          ...decisionHints,
          ["M", "actions"],
          ["a", "AI"],
          ["y", "copy prompt"],
          ["←→", "tab"],
          ["esc", "back"],
        ]

  return (
    <DrillView
      title={`#${item.number} · ${item.repo}`}
      subtitle={item.title}
      hints={hints}
    >
      {/* Above the tabs, never below: below, it would read as belonging to the
          active panel, which is exactly the claim not being made.

          Four tiers now, not three, because the base branch earned one of its
          own. The size is bold, additions in `colors.success` and deletions in
          `colors.error` — sign and digits painted together, the shape every
          diffstat since `git` has drawn, in the two tokens the health glyphs
          already spend on this screen. The file count is the other half of
          "how big" and steps down to plain. Provenance is dim. And `→ base`
          sits back up at PLAIN, because it appears only when the base is NOT
          the repo's default — a fact worth stopping for cannot live in the tier
          this file defines as "look at deliberately or not at all". The head
          branch beside it stays dim: it is not the notable half and must not
          change appearance depending on what it targets.

          Why one colour per sign is now fine, why the base gets no hue at all,
          and why suppression beats always-drawing-it-brighter are all in
          `pr-summary`. The dividers stay dim throughout so the cells read as
          cells — which is also why they are derived from the kept cells here
          rather than written out per pair: a fifth cell that can be absent
          turns hand-written conditional dividers into a combinatorial mess. */}
      {summaryCells.length ? (
        <Box>
          {summaryCells.map(({ key, text }, i) => (
            <React.Fragment key={key}>
              {i > 0 ? (
                <Text dimColor>
                  {separatorBefore(
                    key as keyof Summary,
                    summaryCells[i - 1]!.key as keyof Summary,
                  )}
                </Text>
              ) : null}
              {key === "size" && sizeParts ? (
                <Text bold>
                  <Text color={colors.success}>{sizeParts.added}</Text>{" "}
                  <Text color={colors.error}>{sizeParts.removed}</Text>
                </Text>
              ) : key === "files" || key === "base" ? (
                <Text>{text}</Text>
              ) : (
                <Text dimColor>{text}</Text>
              )}
            </React.Fragment>
          ))}
        </Box>
      ) : null}
      {/* Pinned under the summary, above the tabs: below, it would read as
          belonging to the active panel, which is exactly the claim not being
          made — the decision is the drill's, not the tab's. */}
      {item.needsYou ? <DecisionBlock needsYou={item.needsYou} /> : null}
      <Box marginBottom={1} marginTop={1}>
        <Tabs active={tab} items={tabItems} />
      </Box>
      {/* The decision keys' own line: a pending merge/close confirm first (the
          same wording and colours HealthPanel draws), else the one-line status
          for whatever the keys last did. */}
      {confirm === "merge" ? (
        <Box marginBottom={1}>
          <Text color={colors.warning}>
            {`  Merge #${item.number}?  `}
            <Text color={colors.success}>y</Text>
            <Text dimColor> confirm · any other key cancels</Text>
          </Text>
        </Box>
      ) : confirm === "close" ? (
        <Box marginBottom={1}>
          <Text color={colors.warning}>
            {`  Close #${item.number}?  `}
            <Text color={colors.success}>y</Text>
            <Text dimColor> confirm · any other key cancels</Text>
          </Text>
        </Box>
      ) : note ? (
        <Box marginBottom={1}>
          <Text color={colors.warning} bold>
            {"  " + note}
          </Text>
        </Box>
      ) : null}
      {/* The answer box REPLACES the panel while it is open, as the menu does:
          HealthPanel and CommentsPanel bind bare letters (r retriggers, m asks
          to merge, x resolves) and would act on every one typed into it. */}
      {answering ? (
        <TextInput
          placeholder="Answer… (↵ send · esc cancel)"
          onSubmit={(value) => void submitAnswer(value)}
          onCancel={() => setAnswering(false)}
        />
      ) : menu.actions ? (
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
