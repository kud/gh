---
"@kud/gh-ink": minor
---

Make the inbox cache TTL host-configurable, default 10 minutes

It was a fixed 120s, chosen to bound the pathological case — thirty launches an
hour — rather than the typical one. That inverted the cost: nobody launches
thirty times an hour, but a reader who opens the cockpit every few minutes missed
the cache on essentially every launch and paid the full eight-search query each
time, which is also what draws `HTTP 502` out of the API.

`cacheTtlMs` on `configureInbox`, defaulting to 10 minutes. That still bounds the
pathological case comfortably — six full fetches an hour whatever the launch
rate — while making the ordinary glance-close-glance rhythm free. Staleness is
bounded from the other end regardless: acting on a row drops the cache entry, and
`r` refetches on demand.
