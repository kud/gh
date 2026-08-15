---
"@kud/gh-ink": minor
---

Gate the glance's launch fetch behind a 120s TTL, and drop the cache when an action lands.

The disk cache already existed: launch painted from it, then called `revalidate()` **unconditionally**. So it bought a fast first frame and saved nothing — every launch spent the inbox query's **111 GraphQL points** against a 5000/hour account-wide pool, however recently the last launch ran. A cache that records rather than prevents; the store was there, the freshness policy was not.

Now a cached glance younger than the TTL launches without fetching. `r` still refetches on demand, so nothing strands you on stale rows.

Two things that only matter once an entry is _trusted_ rather than immediately overwritten:

- **Cache files carry a version.** `readCache` validated only that `sections` was an array, so a file written by an older `Section` shape would have deserialised into new code and rendered wrong. An unrecognised version is a miss, costing one cold fetch on upgrade.
- **An action drops the entry synchronously.** Handlers schedule their refresh behind a 1500ms delay to let GitHub settle; quitting inside that window used to leave pre-action rows on disk. Harmless when every launch refetched — a visible wrong answer once the TTL trusts them. The delay now lives with the invalidation rather than being repeated at each call site.

120s bounds the pathological case rather than the typical one: nobody launches thirty times an hour, but at 120s even that ceiling stays inside budget, and "nobody does that" is precisely what was believed about the process that exhausted this pool.
