---
"@kud/gh": minor
---

Ask for 30 of your own PRs, not 100

The single biggest lever on the query's cost, because connections **multiply**:
the health and conversation fragments hang ~80 nodes off each PR, so the outer
number is a multiplier on all of them. GitHub scores a call by the nodes it could
return rather than by how many calls you make — which is why batching saves
nothing and this saves a great deal.

100 × 80 was 8,000 nodes from this one search, of ~25,550 for the whole query at
a measured 111 points. At 30 it is 2,400, roughly halving the query. It was 100
for no reason beyond the search API's own maximum; every other search here
already asks for 20-30.

`issueCount` is now fetched alongside, so the cap cannot drop rows in silence. It
is a scalar and costs nothing, and a host that knows the true total can say what
it is not showing.
