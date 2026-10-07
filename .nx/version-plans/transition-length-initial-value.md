---
'__default__': patch
---

A transition or a `@keyframes` animation now eases a padding, a margin or a `border-radius` that no rule sets from or to 0, as a browser does. `view { transition: padding 200ms }` with `.open { padding: 20px }` eases the padding in and back out, where it jumped.
