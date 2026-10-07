---
'__default__': patch
---

A `steps()`, `step-start` or `step-end` easing in an `animation` or `transition` now drops only that declaration, with a warning naming it, and the rest of the rule is kept. It used to drop the whole rule, so a spinner lost its size and a fading dot its opacity. In a rule that names no animation or no transition properties, where each longhand cascades on its own, only the `animation-timing-function` or `transition-timing-function` is dropped, and so is only the `transition-duration` or `transition-delay` list with no `transition-property` beside it. A step `animation-timing-function` inside a keyframe still drops the whole `@keyframes`, so the animation does not play rather than play eased.
