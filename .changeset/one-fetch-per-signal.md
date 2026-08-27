---
"@kud/gh-ink": minor
---

One signal, one fetch — however many cockpits are open

A mutation signal wakes every running cockpit, and each paid the full query for
the same answer. Three open cockpits turned one closed issue into three fetches,
at 111 GraphQL points each: about fifteen signals an hour and a 5,000-point
budget is gone.

The cache is already shared on disk and keyed per scope, so a sibling that has
refetched since the signal holds exactly what we would pay for. The watch path
now adopts that instead of refetching — strictly *after* the signal, since an
entry written before it is stale by definition.

Two details make it work rather than merely look right. A `watchJitterMs` spread
(3s by default) staggers the woken instances, or they would all check in the
same millisecond, all miss, and all fetch — the very behaviour this replaces. A
lost race degrades to the old behaviour, never worse. And an adopted result goes
through the same path as a fetched one, so it still passes the manual-apply gate
rather than reshuffling the list under you.

No daemon, no socket, no process to own: the file is the broker, as it already
was for the signal itself.
