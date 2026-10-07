---
'__default__': patch
---

A unitless `line-height` is inherited as the number, as on the web. Under `.card { font-size: 10px; line-height: 2 }`, a text with `font-size: 20px` now has lines 40 points tall, where it took the card's 20. The same goes for a number in the `font` shorthand, `font: 10px/2 serif`, and for one held in a custom property. A percentage or an `em` is still worked out where it is written, and those points are what a descendant inherits.
