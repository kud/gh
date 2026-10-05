---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

The Jira move submenu used to offer a static list of transitions per ticket, with no idea what the ticket's workflow currently allows. Picking a transition the workflow does not offer from that state is a silent no-op — `jira issue move` matches nothing and the row simply does not budge — so the menu could confidently offer moves that cannot work.

A host can now pass `jiraTransitionsFor`, a `(ticket) => Promise<...>` hook alongside `jiraTransitions`. When present, opening the move submenu asks the workflow for that ticket's live transitions instead of listing the static set: known transitions keep their place, label and resolution step from the static list, anything else is still offered after them alphabetically, and the answer is cached per ticket and status for the session (dropped after a move lands). Failures open a retry row rather than falling back to the static list. Without the hook the submenu is byte-for-byte the static list it always was.
