---
"@kud/gh-ink": patch
---

The on-disk glance is invalidated once, so upgrading does not open with the burst it just fixed.

`Section.sampled` is optional, so a cache entry written by the previous version deserialises perfectly well — and that is the problem rather than the reassurance. A cached section carries no flag, reads as whole, and the first diff after upgrading compares it against a fetch that knows better. Every row the window had rotated through in the meantime would be reported as an arrival or a departure: one burst of exactly the false marks this release exists to stop, landing on the first refresh after installing it.

`CACHE_VERSION` goes to 4. An unrecognised version is a miss, so the cost is one cold fetch, once, on upgrade — cheaper than the thing it avoids, and the same trade the bump to 3 made for `budget`.
