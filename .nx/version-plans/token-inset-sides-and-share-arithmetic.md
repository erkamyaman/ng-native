---
__default__: patch
---

Two tokens in a stylesheet are now read the way CSS reads them, where each was laid out wrong without a warning:

- `inset: var(--i)` with a token of several lengths, `--i: 1px 2px`, gives each side its own length, as `inset: 1px 2px` does. Every side took the first one.
- `calc()` arithmetic around a token that holds a percentage, `width: calc(var(--p) - 10px)` with `--p: 50%`, is applied to that percentage, as it is to one written beside a token, outside a `max()`. The box was given the bare `50%`. This is for a box's width and height, their minimums and maximums, its flex basis, insets, margins and padding. A length added to or taken from such a token, on a property with no box for the percentage such as a border width, leaves that property unset rather than giving it the percentage.
