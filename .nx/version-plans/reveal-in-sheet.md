---
__default__: patch
---

A `<text-input>` focused while the keyboard is up now scrolls clear of the keyboard in a sheet attached to the bottom of the screen on iOS, and no longer asks a scroll view resting under a navigation bar to scroll to zero.

On iOS, React Native measures a view in a presented sheet from the sheet's top, while the keyboard's top counts from the top of the screen, so `engine.reveal()` stopped short by the sheet's distance from the top of the screen and could leave the field behind the keyboard. It now takes that distance off the keyboard's top for a screen presented as `modal`, `formSheet` or `pageSheet`, and for a `<modal>` with `presentationStyle` `pageSheet` or `formSheet`, when the sheet is as wide as the window and taller than the room above the keyboard: such a sheet is attached to the bottom of the screen. A narrower sheet (an iPad's, or one floating at a partial detent) and a shorter one, which may have risen over the keyboard, are measured as before. Android is unchanged.

`reveal()` also clamped its target at zero, so a scroll view resting above zero under a navigation bar (`contentInsetAdjustmentBehavior="automatic"`) was sent to zero, under the bar, for a move of a few points. It now sends it no further up than zero or where it already is, whichever is further up. React Native's own `scrollTo` on iOS still stops at zero when the scroll view has no `contentInset` of its own.
