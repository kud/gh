---
"@kud/gh": minor
---

`issueCount` no longer decides whether a source was truncated, because it is not a total.

`sourceCoverage` reported `truncated: total > shown`, which reads as "the cap bit here" and is not the same claim. `issueCount` is an index aggregate computed on a different path from the node materialisation, and the two are not a consistent snapshot. Measured 2026-09-09 against a live account, in one sweep taken immediately after an eight-source document had returned HTTP 502: `myPRs` answered `issueCount: 8` alongside sixteen nodes, `repoPRs` answered `4` alongside five, and `repoIssues` answered `111` alongside eighty-three against a cap of a hundred. The first two are the proof rather than the symptom — a count exceeded by its own sample is not a total. Every pair agreed again seconds later, and twenty-four subsequent runs of the real query agreed too, which makes the number untrustworthy at unpredictable moments rather than merely stale. That is the worse of the two.

What it cost downstream was a host reporting five truncated sources of which not one was near its cap, each explained by a sentence about caps. A true sentence about a false situation is the hardest kind of wrong to read, and the reader correctly could not parse it.

So the single `truncated` boolean is replaced by two facts and an estimate. `capped` is `shown >= cap` — derived from the request we made rather than from GitHub's count, and a cap cannot be wrong about itself. `partial` is a source that came in under its cap while the count still claims more matched: nothing was capped and rows are missing anyway, which is an incomplete answer rather than a truncation and belongs with whatever vocabulary a host uses for a source that failed. `total` survives as an estimate that may be shown to a reader as an approximation and may never decide whether anything is reported.

`sourceCoverage` and `cappedSources` (was `truncatedSources`) now take the limits the fetch actually asked for. A two-tier host that raises `reviewRequests` to a hundred and then measures against the default twenty would read as capped forever and keep firing an overflow fetch that had already succeeded.

The impossible reading is pinned in a test, because it is the evidence and there is nowhere else for it to live.
