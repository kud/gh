import { $ } from "zx"
import React, { useEffect, useRef, useState } from "react"
import { Box, Text, useInput } from "ink"
import { colors, Tabs, TextInput, type TabItem } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"
import { CommentsPanel, fetchComments } from "./comments-panel.js"
import { AiLauncher, CopyPromptNotice } from "./ai-panel.js"
import { seedPromptFor } from "../prompts.js"
import { DecisionBlock } from "./decision-block.js"
import { decisionHooks } from "../decision.js"
import { useCachedResource } from "./cache.js"
import type { NeedsYou } from "../lib.js"

type Tab = "conversation"

// The issue drill, deliberately the same screen as PrView minus the tabs an
// issue has no data for. Same frame, same tab bar, same conversation renderer,
// same keymap — an issue is a PR without checks, reviews or a merge, and the
// detail screens now differ only by which tabs exist rather than by how they
// work. The previous version fetched and laid out its own markdown, which is
// why the two looked like different products.
export const IssueView = ({
  item,
  login,
  onBack,
  onRefresh,
  onRemove,
  registerPeel,
  onTyping,
}: {
  item: {
    number: number
    repo: string
    url: string
    title?: string
    labels?: readonly string[]
    needsYou?: NeedsYou
  }
  login: string
  onBack: () => void
  // The close key (`X`) needs somewhere to report the row went: `onRemove`
  // drops it the way PrView's does, falling back to `onBack`, and `onRefresh`
  // refetches after anything the keys change. `onRemove` takes no row back —
  // this view only holds the subset above, not the full `GHItem`, so detail.tsx
  // closes over its own item when it wires this up.
  onRefresh?: () => void
  onRemove?: () => void
  // `esc` and `backspace` are the app's — see `DetailContext`. This view says
  // what to close; it does not bind them.
  registerPeel?: (peel: (() => boolean) | null) => void
  onTyping?: (typing: boolean) => void
}) => {
  const [replying, setReplying] = useState(false)
  const [ai, setAi] = useState(false)
  const [copy, setCopy] = useState(false)
  // Same decision furniture as PrView, minus the keys an issue has no data
  // for — no diff, no merge, no ready. `c` answers, `X` closes.
  const [answering, setAnswering] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const comments = useCachedResource(
    `issue-comments-${item.repo}-${item.number}`,
    () => fetchComments(item.repo, item.number, "issue"),
  )
  const tabItems: TabItem<Tab>[] = [
    { value: "conversation", label: "Conversation" },
  ]

  // Mirrors PrView's peel, minus the layers an issue does not have — no check
  // log, no file picker, no action menu. `replying` is the same unreachable
  // guard it is there: the root stands its keys down while the box has focus.
  const aiPeel = useRef<(() => boolean) | null>(null)
  const peel = (): boolean => {
    if (answering) return (setAnswering(false), true)
    if (confirmClose) return (setConfirmClose(false), true)
    if (replying) return true
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

  // Human keypresses only, like PrView's — no auto-trigger anywhere — through
  // zx's `$` with `.quiet()`, never a raw gh stderr line outside the frame.
  const doClose = async () => {
    setNote("⋯ closing…")
    try {
      await $`gh issue close ${item.number} --repo ${item.repo}`.quiet()
      setNote(null)
      if (onRemove) onRemove()
      else onBack()
    } catch (e) {
      setNote(`✗ close failed: ${(e as Error).message}`)
    }
  }

  const submitAnswer = async (body: string) => {
    const text = body.trim()
    setAnswering(false)
    if (!text) return
    setNote("Posting…")
    try {
      await $`gh issue comment ${item.number} --repo ${item.repo} --body ${text}`.quiet()
      setNote("✓ Answered")
      await decisionHooks().answered?.({
        kind: "issue",
        repo: item.repo,
        number: item.number,
        url: item.url,
        labels: item.labels,
      })
    } catch (e) {
      setNote(`✗ ${(e as Error).message}`)
    }
  }

  useInput(
    (input, key) => {
      // Decision keys, live only while the host marked this row — the same
      // pair PrView offers an issue-shaped row, and the same confirm shape.
      if (item.needsYou) {
        if (confirmClose) {
          if (input === "y" || input === "Y") void doClose()
          setConfirmClose(false)
          return
        }
        if (input === "c") {
          setAnswering(true)
          return
        }
        if (input === "X") {
          setConfirmClose(true)
          return
        }
      }
      if (input === "o") $`open ${item.url}`.catch(() => {})
      // Same key as PrView's, deliberately: the two drills mirror each other, and
      // an issue is the half of the inbox that most often wants delegating.
      if (input === "a") setAi(true)
      if (input === "y") setCopy(true)
    },
    { isActive: !replying && !ai && !copy && !answering },
  )

  if (ai)
    return (
      <AiLauncher
        item={item}
        login={login}
        prompt={seedPromptFor({ ...item, kind: "issue" })}
        onBack={() => setAi(false)}
        peelRef={aiPeel}
      />
    )

  if (copy)
    return (
      <CopyPromptNotice
        item={{ ...item, kind: "issue" }}
        onBack={() => setCopy(false)}
      />
    )

  return (
    <DrillView
      title={`#${item.number} · ${item.repo}`}
      subtitle={item.title}
      hints={[
        ["↑↓", "scroll"],
        ...(item.needsYou
          ? ([
              ["c", "answer"],
              ["X", "close"],
            ] as [string, string][])
          : []),
        ["a", "AI"],
        ["y", "copy prompt"],
        ["o", "open in browser"],
        ["esc", "back"],
      ]}
    >
      {/* Pinned under the title, above the tab — the drill's, not the tab's,
          the same claim DecisionBlock makes on PrView. */}
      {item.needsYou ? <DecisionBlock needsYou={item.needsYou} /> : null}
      {confirmClose ? (
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
      <Box marginBottom={1}>
        <Tabs active="conversation" items={tabItems} />
      </Box>
      {/* The answer box REPLACES the conversation while it is open rather
          than sitting under it: CommentsPanel binds bare letters (x resolves,
          r replies) and would act on every one of them typed into the answer. */}
      {answering ? (
        <TextInput
          placeholder="Answer… (↵ send · esc cancel)"
          onSubmit={(value) => void submitAnswer(value)}
          onCancel={() => setAnswering(false)}
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
