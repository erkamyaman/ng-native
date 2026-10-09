---
'__default__': patch
---

A `<text-input>` in a browser hands `(keyPress)` and `(selectionChange)` React Native's payloads: `{ nativeEvent: { key } }` with `Backspace`, `Enter` or the character typed, and `{ nativeEvent: { selection: { start, end } } }` whenever the caret moves or a range is selected.

`(keyPress)` was bound to the DOM's `keypress` event and handed it raw, so reading `$event.nativeEvent.key` threw on every character and `Backspace` sent nothing at all. `(selectionChange)` never fired.
