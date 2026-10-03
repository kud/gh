---
"@kud/gh": minor
---

A host can now hide repositories from the inbox entirely. A throwaway repo that integration tests open and close pull requests in used to surface on every board that read the account, and the only way to keep it out was to filter rows after the fetch, which left each search's total still counting it and its rows still taking slots that real work should have had. `excludeRepos` on `buildInboxQuery`, `buildInboxQueries` and `buildPulseQuery` now adds a `-repo:` qualifier to every search, so the hidden repo never comes back from GitHub at all and the pulse stops waking a board for changes it will not show. A name that is not an `owner/name` slug throws rather than being skipped, since a repo that silently stays visible is the failure the option exists to prevent.
