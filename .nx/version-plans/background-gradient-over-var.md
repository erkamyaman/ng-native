---
__default__: patch
---

A `background` shorthand of gradients over a color from a token, as in `background: linear-gradient(180deg, #ffffff33 0%, #ffffff00 67.7%), var(--primary)`, now draws the gradients over the token's color, where it was dropped whole with a message that it mixes `var()` with other values.

The gradients, and their position, size and repeat, are compiled as written, and the last layer is read on device as `background-color` reads it: a `var()`, or a color made of one such as `color-mix()` or `rgba(var(--channels), 0.5)`. With the token unset, or set to something that is not a color, the whole background is unset, gradients included. A browser reads the token as the whole last layer, so one holding a position or a gradient still paints the written gradients there. A token in a gradient as well as in the color, or anything written beside the color in the last layer, is still refused with the message.
