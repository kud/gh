import React, { useEffect } from "react"
import { AiLauncher, seedPromptFor } from "../views/ai-panel.js"
import type { AnyItem, GHItem, InboxExtension } from "../lib.js"

// Delegating straight from the browse list, without drilling into the row first —
// the same launcher `a` opens inside PrView and IssueView, one keystroke earlier.
// It is a keyed extension rather than another arm in @kud/gh-ink because the shell
// knows a row is selected, not what cockpit wants done with it; gh-ink dispatches
// on InboxExtension.key and cockpit supplies the binding.
const isDelegatable = (item?: AnyItem): item is GHItem =>
  item?.kind === "pr" || item?.kind === "issue"

// The overlay mounts before anything can check whether the active row is one we
// can act on — the browse screen underneath is hidden and stops handling input, so
// returning null would strand the user on a blank screen with no way back. A Jira
// row is the case that actually reaches here on the work cockpit. Hand focus back
// instead.
const DelegateScreen = ({
  item,
  login,
  onExit,
}: {
  item?: AnyItem
  login: string
  onExit: () => void
}) => {
  const delegatable = isDelegatable(item)
  useEffect(() => {
    if (!delegatable) onExit()
  }, [delegatable, onExit])

  if (!delegatable) return null
  return (
    <AiLauncher
      item={item}
      login={login}
      prompt={seedPromptFor(item)}
      onBack={onExit}
    />
  )
}

export const delegateExtension: InboxExtension = {
  id: "delegate",
  title: "Delegate to an agent",
  key: "a",
  // Short enough for the footer strip, where "delegate to an agent" would crowd out
  // the bindings either side of it. Matches the drill views' own `a AI` hint.
  hint: "AI",
  // Item-scoped: this acts on the selected row, so it earns a place in that row's
  // action menu under `m`. Without this it would still work as a keypress and stay
  // absent from the menu, which is exactly the gap that prompted 0.5.0.
  scope: "item",
  body: (onExit, target) => (
    <DelegateScreen
      item={target?.item}
      login={target?.login ?? ""}
      onExit={onExit}
    />
  ),
}
