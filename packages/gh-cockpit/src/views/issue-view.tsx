import { $ } from "zx"
import React, { useEffect, useRef, useState } from "react"
import { Box, useInput } from "ink"
import { Tabs, type TabItem } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"
import { CommentsPanel, fetchComments } from "./comments-panel.js"
import { AiLauncher, CopyPromptNotice } from "./ai-panel.js"
import { seedPromptFor } from "../prompts.js"
import { useCachedResource } from "./cache.js"

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
  registerPeel,
  onTyping,
}: {
  item: {
    number: number
    repo: string
    url: string
    title?: string
    labels?: readonly string[]
  }
  login: string
  onBack: () => void
  // `esc` and `backspace` are the app's — see `DetailContext`. This view says
  // what to close; it does not bind them.
  registerPeel?: (peel: (() => boolean) | null) => void
  onTyping?: (typing: boolean) => void
}) => {
  const [replying, setReplying] = useState(false)
  const [ai, setAi] = useState(false)
  const [copy, setCopy] = useState(false)

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
    if (replying) return true
    if (ai) return aiPeel.current?.() ?? (setAi(false), true)
    if (copy) return setCopy(false), true
    return false
  }
  useEffect(() => {
    registerPeel?.(peel)
    return () => registerPeel?.(null)
  })
  useEffect(() => {
    onTyping?.(replying)
  }, [replying, onTyping])

  useInput(
    (input, key) => {
      if (input === "o") $`open ${item.url}`.catch(() => {})
      // Same key as PrView's, deliberately: the two drills mirror each other, and
      // an issue is the half of the inbox that most often wants delegating.
      if (input === "a") setAi(true)
      if (input === "y") setCopy(true)
    },
    { isActive: !replying && !ai && !copy },
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
        ["a", "AI"],
        ["y", "copy prompt"],
        ["o", "open in browser"],
        ["esc", "back"],
      ]}
    >
      <Box marginBottom={1}>
        <Tabs active="conversation" items={tabItems} />
      </Box>
      <CommentsPanel
        repo={item.repo}
        number={item.number}
        data={comments.data}
        error={comments.error}
        reload={comments.reload}
        onReplyingChange={setReplying}
        showConversationHeading={false}
      />
    </DrillView>
  )
}
