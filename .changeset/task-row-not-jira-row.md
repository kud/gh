---
"@kud/gh-ink": minor
---

Rename the `jira` row kind to `task`, and make the Jira behaviour opt-in.

The row was named after its first caller, not after what it is: a keyed,
two-column row. `life` reuses it to render Todoist tasks, and inherited every
Jira affordance along with the layout — ↵ opened a menu led by "View ticket",
which ran `jira issue view` on whatever sat in `key`. In `life` that is a padded
Todoist project name, on a surface that has never touched Jira.

`kind: "jira"` is now `kind: "task"`, `JiraRow` is `TaskRow`, and `jiraStatus`
is `status`. A new optional `ticket` field carries the Jira issue key when one
exists; its presence is what turns on the drill and the `t` transitions, and the
`jira` commands now read the key from it rather than from `key`. A row without a
`ticket` opens its URL on ↵ and never shells out to `jira`.

Breaking for callers constructing these rows — rename the three fields.
