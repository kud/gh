import { describe, expect, it } from "vitest"

import { drillCmd } from "./inbox.js"
import type { TaskRow } from "./inbox.js"

/*
 * What is pinned here is that `life` cannot reach Jira.
 *
 * The row used to be called `jira`, and the drill was read off `key` — a field
 * every caller fills with whatever labels the row. `life` fills it with a padded
 * Todoist project name, so ↵ ran `jira issue view "Maison       "` on a surface
 * that has never touched Jira. `ticket` exists so the affordance follows the
 * ticket rather than the label.
 */

const row = (extra: Partial<TaskRow> = {}): TaskRow => ({
  kind: "task",
  key: "Maison      ",
  summary: "sortir les poubelles",
  url: "https://app.todoist.com/app/task/1",
  status: "p2",
  age: "2d",
  indent: false,
  ...extra,
})

describe("task row drill", () => {
  it("has no drill when no ticket sits behind the row", () => {
    expect(drillCmd(row())).toBeNull()
  })

  it("drills the ticket, never the label in `key`", () => {
    expect(drillCmd(row({ key: "in progress", ticket: "ABC-42" }))).toBe(
      "jira issue view ABC-42",
    )
  })
})
