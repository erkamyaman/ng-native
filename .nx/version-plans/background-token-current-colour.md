---
__default__: patch
---

`background-image: var(--g)` now draws the gradients its token holds, `currentColor` in a background token's last layer is now the text colour, and a written `background: platform-color(...)` in a stylesheet now takes away a weaker rule's image, as Chrome does for each.

`background-image: var(--g)` was dropped with a warning in a stylesheet and in a `style` attribute or `[style.background-image]` binding. It now reads a token from a stylesheet, one set on an element, or a fallback. A token of `none`, one with a colour in it or one that holds no image leaves no image, as in Chrome, where such a value is invalid.

A token such as `--x: center currentColor` in `background: linear-gradient(...), var(--x)` or `background: var(--x)` was read as invalid, so nothing was drawn. Its colour is now the element's text colour, its own or inherited, and follows it when it changes. The same holds for a token set on an element, a `var()` fallback, and `background: linear-gradient(...), currentColor` in a `style` attribute or `[style.background]` binding, which was dropped with a warning.

`background: platform-color(link)` in a stylesheet now writes no image and the initial position, size and repeat, as `background: red` does, where a weaker rule's image stayed. A system colour such as `background: LinkText` already did this, and so did a `style` attribute or a `[style]` binding.
