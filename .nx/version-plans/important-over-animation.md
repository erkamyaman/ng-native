---
'__default__': patch
---

A `@keyframes` animation leaves a property a rule declares `!important` where the rule puts it, as a browser does.

`view { opacity: 0.3 !important; animation: fade 1s }` faded the view from 0 to 1 over its own important opacity. An important declaration is above an animation in the cascade, so the view stays at 0.3, and the animation still moves every property that is not important. A transition still eases an important property.
