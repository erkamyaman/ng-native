---
'__default__': patch
---

A deep link that arrives while the app is running is pushed over the screen showing, as the Screens page says, when the app has no `withLinkParent`. A link to a url already further down the stack went back to that screen instead and closed the ones above it; now Back from the link returns to the screen it was opened over.

Two different links that arrive back to back leave only the last one above the screen that was showing, since the second push supersedes the first.
