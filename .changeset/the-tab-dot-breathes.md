---
"@kud/gh-ink": patch
---

The tab marker breathes at 150ms instead of 450ms, and stops snapping.

The dot on a tab holding unread news ran a four-frame sawtooth — `· ○ ◎ ◉`, then straight back to `·` — one frame every 450ms, so a full breath took 1.8 seconds. Beside a 7-second hold that reads as a marker someone forgot to switch off rather than one asking to be collected.

It took that rate from the row transit marks, which share the same ticker through a divisor, and the reasoning behind the divisor was sound but aimed at the wrong axis. What it protects against is motion sitting **beside text you are reading**: a row mark strobing three times a second in the reading line is an interruption, not a marker, and that is still true and still unchanged. The tab marker is not in the reading line. It lives in the peripheral bar, where vision is motion-sensitive and text-blind — which is the entire reason the pulse was put up there. Nothing is being read next to it, so there is nothing for it to interrupt. The split had been made by animation when the thing that actually differs is where on the screen it lands.

The shape moves with the tempo, and the shape was doing more of the damage. `◉` snapping back to `·` is a discontinuity, and a discontinuity read at speed is a blink — at 150ms the old ramp would have flashed once a second, which is a smoke alarm rather than a pulse. The ramp now runs out and back, `· ○ ◎ ◉ ◎ ○`, so every step is one ring's change in the same direction and the dot swells rather than restarting. Six frames at 150ms is a 900ms breath.

The row ramps keep their sawtooth deliberately. `TRANSIT_OUT_FRAMES` dissolving and `TRANSIT_IN_FRAMES` coalescing is directional information — a row that thinned to a dot and filled back in would be claiming it left and returned. The two shapes now differ because they mean different things, which is a better vocabulary than the one where they matched. The merge sparkle is untouched: it was already out-and-back through `✧`, and 150ms is what makes it read as a twinkle.

Taking the ticker undivided also puts the tab pulse back in phase with the sparkle, which is what the one shared ticker existed to guarantee in the first place.
