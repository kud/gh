---
"@kud/gh-ink": patch
---

The loading frame no longer runs past the bottom of the terminal when the host draws a status strip and a focus slot. Its body took two rows off for the CI line but none for the strip or the slot, so a cold launch with both drew four rows more than it budgeted and three more than the screen: Ink cleared and repainted the whole terminal on every spinner tick with the header scrolled out of view, and the frame dropped back into place when the fetch landed. Both rows now come out of the body, the same reservations the browse list makes, so the loading frame is the height of the loaded one and nothing moves when the rows arrive.
