---
'__default__': patch
---

A colour transition or `@keyframes` animation now mixes the two colours in premultiplied alpha, as a browser does. Halfway from `transparent` to red is red at half opacity, where it was a dark red, and a colour at part opacity pulls the mix less than an opaque one does.
