---
__default__: patch
---

A screen pushed while the app's first navigation is still running, such as a notification tapped at launch or a deep link under `withLinkParent`, now waits for a root guard's redirect to land instead of cancelling it. Before, the redirect was dropped and the pushed screen opened alone, past the guard that would have sent the app to sign in.
