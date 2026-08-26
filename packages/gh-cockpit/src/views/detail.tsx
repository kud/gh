import React from "react"
import type { DetailContext } from "../lib.js"
import { PrView } from "./pr-view.js"
import { IssueView } from "./issue-view.js"

// What a drilled-in row looks like, for BOTH cockpits. The shell knows a row was
// opened; it does not know what a PR should look like once it is — but that
// answer has never differed between the two surfaces, only the grouping above it
// has.
//
// Shared because it was copied, and the copy drifted the way copies do: the work
// cockpit's version omitted `onMerged`, so merging from the drill-in view left
// its list holding a row that no longer existed. The comment above the copy read
// "See gh-cockpit" — it knew what it was, which is the point at which it should
// have been one function.
export const detailFor = (ctx: DetailContext) =>
  ctx.kind === "pr" ? (
    <PrView
      item={ctx.item}
      login={ctx.login}
      onBack={ctx.onBack}
      onRefresh={ctx.onRefresh}
      onRemove={ctx.onRemove}
      onMerged={ctx.onMerged}
    />
  ) : (
    // No refresh/remove/merged: IssueView has no action menu to hang them off,
    // so passing them would type-check into a handler nothing ever calls. They
    // belong here the day it grows the `M` menu PrView has.
    <IssueView item={ctx.item} login={ctx.login} onBack={ctx.onBack} />
  )
