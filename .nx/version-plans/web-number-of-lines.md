---
'__default__': patch
---

A `<text>` with `numberOfLines` is cut to that many lines in a browser, ending in an ellipsis as on a device, where it wrapped onto every line before. `ellipsizeMode="clip"` cuts it without the ellipsis, and `head` and `middle` end it at the tail, which is all CSS can say.
