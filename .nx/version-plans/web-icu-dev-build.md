---
__default__: patch
---

A template ICU plural or select now renders on the web host in a development build, where it threw `ASSERTION ERROR: The provided value must be an instance of a DOM Node`.

Angular's development checks on the i18n path test each node with `instanceof Node`, and the web host hands Angular its own node objects rather than DOM nodes. In a development build the web host now makes the page's `Node` answer `true` for those objects, as the `Node` global already does on iOS and Android, and answers as before for every other value. A release build leaves `Node` untouched.
