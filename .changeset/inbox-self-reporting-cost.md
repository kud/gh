---
"@kud/gh": patch
---

Select `rateLimit { cost nodeCount remaining resetAt }` on the inbox query.

It is free — `rateLimit` does not count against itself — and it is the only authoritative source for what the query costs. Every estimate made about that cost on 2026-08-14 was wrong, one of them by 25×, because GraphQL cost is node-count based and nested connections multiply: `reviewThreads(first: 50)` beneath `search(first: 100)` is 5,000 nodes from two lines of query text.

A consumer can now log what a fetch spent instead of inferring it from a rate-limit delta, which measures whatever else happened in the window rather than the thing you asked about.
