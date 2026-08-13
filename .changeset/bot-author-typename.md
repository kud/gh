---
"@kud/gh": minor
---

Carry `__typename` on every conversation author in the inbox query, so a consumer can tell a GitHub App apart from a person.

A login cannot do this on its own: GraphQL reports app authors bare (`greptile-apps`), without the `[bot]` suffix REST adds. Whose-turn logic needs the distinction because a push answers a machine's review and does not answer a person's.
