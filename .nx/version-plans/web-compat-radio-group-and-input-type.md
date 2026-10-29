---
__default__: patch
---

In `@ng-native/web-compat`, a checked radio put in the page, or moved into another group by setting its `name`, `form` or `type`, unchecks the radio that was checked in that group, as in a browser. Before, both stayed checked.

An `<input>` whose `type` HTML does not know, such as `datetime` or an empty string, is a text field: it can be typed into, has a selection, and matches `:read-write` and `:placeholder-shown`. Before, it was drawn as a plain view that took no text.
