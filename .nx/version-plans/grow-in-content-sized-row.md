---
__default__: patch
---

A row that is as wide as its content (`align-self: flex-start` in a column, an item of a row, `inline-flex`, out of the flow, `width: fit-content` or `max-width: max-content`) stays as wide as its content when an item in it grows with `flex-grow` or `flex`, as in a browser, where it filled all the room it could have.

React Native's Yoga hands an item that grows all the room a row sized by its content could have had, so a segmented control's tray with `flex-grow: 1` segments filled its column. A row the engine fits to its content is now measured with its growing items set aside, as it already was with a `flex-1` cell or a percentage, and an item in a `fit-content` row does not grow. A row that is stretched, or has a width of its own, still grows its items into it.
