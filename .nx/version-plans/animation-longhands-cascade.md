---
__default__: patch
---

Each `animation-*` longhand now cascades on its own, as in a browser, so `.b { animation-name: y }` beside `.a { animation: x 1s infinite }` plays `y` for 1s, forever.

Before, each rule built a whole animation, and the stronger one replaced the weaker one's outright: the name alone played with a duration of 0 and never showed, and a rule that set only the timing, such as `animation-duration: 2s`, was dropped. A shorthand still resets every part, as it does on the web.
