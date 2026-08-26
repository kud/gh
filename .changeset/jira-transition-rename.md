---
"@kud/gh-ink": minor
---

Rename `JiraTransition.state` to `transition`

**Breaking.** The field is passed verbatim to `jira issue move`, which matches
`t.name.toLowerCase() === wanted` — transition names, never destination
statuses, and the two are routinely different strings. Calling it `state`
invited passing a status, which matches no transition, so the move silently does
nothing and the row does not budge. No error, no output, nothing to grep.

That is not hypothetical: cockpit shipped `{ label: "UAT", state: "UAT" }`
against an ACC workflow whose transition is named "Ready for QA" and whose
status is "In Testing (QA)". There is no "UAT" anywhere in it.

Rename the field at each call site; the value was always meant to be the
transition name, so nothing else changes.
