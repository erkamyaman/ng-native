---
'__default__': patch
---

A `<native-header>` in a tab's page that has no stack of its own no longer configures the stack screen that holds the whole tab bar. On Android it showed its bar above the tab bar, on every tab, even when the tabs page hid its own.
