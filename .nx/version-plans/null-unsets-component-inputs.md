---
__default__: patch
---

A `null` bound to an optional number or boolean input in `@ng-native/components` or `@ng-native/expo`, or to an optional boolean input in `@ng-native/router`, is now unset as `undefined` is, where a number sent native `NaN` and a boolean sent `false`.

Among them are `[numberOfLines]` on `<text>`, `[maxLength]` on `<text-input>`, `[spacing]` on
`<expo-glass-container>` and `[collapsable]` on `<view>`; `[size]` on `<expo-symbol>` takes its
default of 24. A binding that turns from a value to `null` removes the prop, so native goes back to
its default. A boolean bound to `null` now takes the default an unset one takes rather than
`false`: `[accessible]` and `[focusable]` on a component that is accessible or focusable by
default, `[stickySectionHeadersEnabled]` (sticky on iOS), `[alwaysBounceVertical]` on a vertical
scroll view, and `aria-busy`, `aria-checked`, `aria-disabled`, `aria-expanded` and
`aria-selected`, which are left out of the accessibility state rather than set to `false`.
