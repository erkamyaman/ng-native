---
'__default__': patch
---

`userEvent.press`, `longPress`, `type` and `clear`, and `fireEvent.press`, do nothing on a node a finger could not reach, as React Native Testing Library decides it: one that is `pointerEvents` `none` or `box-none` itself, or one under a view that is `none` or `box-only`. `pointer-events: none` in CSS counts too. A test that the button is blocked while an overlay is up passed before, because the press went through.

A query `RegExp` with the `g` or `y` flag finds every match. It tested each node from where its last match ended, so `getAllByText(/item/gi)` over four items found two, and a second `getByText` with the same `RegExp` could miss.
