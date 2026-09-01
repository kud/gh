import { $ } from "zx"
import React, { useState } from "react"
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
}: {
  item: {
    number: number
    repo: string
    url: string
    title?: string
    labels?: string[]
  }
  login: string
  onBack: () => void
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

  useInput(
    (input, key) => {
      if (key.escape || input === "q") return onBack()
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
        ["q/esc", "back"],
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
