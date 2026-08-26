import React, { useEffect } from "react"
import { CopyPromptNotice } from "../views/ai-panel.js"
import type { AnyItem, GHItem, InboxExtension } from "../lib.js"

// Delegation's other half: `a` opens a fresh session here, `y` hands the prompt
// to one already running somewhere else — an atelier colleague, a tab left open
// on the work laptop. Same row, same intent, different transport, so it is a
// sibling extension rather than a third step inside the launcher.
const isCopyable = (item?: AnyItem): item is GHItem =>
  item?.kind === "pr" || item?.kind === "issue"

// Same guard as delegate's, for the same reason: the overlay mounts before
// anything can check the row is one we can act on, and the browse screen
// underneath has already stopped handling input. A row that is neither a PR nor
// an issue is what reaches here — hand focus back rather than strand it on a
// blank screen.
const CopyPromptScreen = ({
  item,
  onExit,
}: {
  item?: AnyItem
  onExit: () => void
}) => {
  const copyable = isCopyable(item)
  useEffect(() => {
    if (!copyable) onExit()
  }, [copyable, onExit])

  if (!copyable) return null
  return <CopyPromptNotice item={item} onBack={onExit} />
}

export const copyPromptExtension: InboxExtension = {
  id: "copy-prompt",
  title: "Copy prompt to clipboard",
  // `y` for yank: `c` and `b` are gh-ink's own copy-URL and copy-branch, and `p`
  // is open-repo-in-pane.
  key: "y",
  hint: "copy prompt",
  scope: "item",
  body: (onExit, target) => (
    <CopyPromptScreen item={target?.item} onExit={onExit} />
  ),
}
