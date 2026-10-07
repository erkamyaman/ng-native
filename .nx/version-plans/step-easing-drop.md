---
'__default__': patch
---

A `steps()`, `step-start` or `step-end` easing in an `animation` or `transition` now drops only that declaration, with a warning naming it, and the rest of the rule is kept. It used to drop the whole rule, so a spinner lost its size and a fading dot its opacity. A `transition-duration` or `transition-delay` list with no `transition-property` beside it is dropped the same way, and a keyframe whose own `animation-timing-function` is a step keeps its other declarations instead of taking the whole `@keyframes` with it.
