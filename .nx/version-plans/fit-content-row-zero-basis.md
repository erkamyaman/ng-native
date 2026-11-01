---
__default__: patch
---

A row that is `width: fit-content` or `max-width: max-content` stays as wide as its items when one of them grows, as in a browser, where with `layoutConformance: 'strict'` it had no width at all when the item grew from a basis of zero points (`flex: 1 1 0px`, or React Native's `flex: 1`), and could otherwise fill all the room on offer.

The engine fits such a row to its content, as it already fits a row with `align-self: flex-start` in a column, and fits a `width: fit-content` box around a row the same way. A row first laid out with a width, a stretch or a growth of its own, and then let go of it in its `style`, is fitted to its content again, where it kept the width Yoga gave it, which could be none or all the room on offer.
