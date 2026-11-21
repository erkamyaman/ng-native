---
__default__: patch
---

`nx sync:check` now says an app lacks a native module or its config plugin, rather than that a development build would not link the module, which holds only where the app imports a library through a path alias.

Expo's autolinking walks the app's dependency tree, so a native module a library imports is linked when the library is a workspace package the app lists, and only when the app lists the module where it imports the library through a tsconfig path alias. The sync generator still adds the module to the app, where `expo install --check` checks its version, and its config plugin to `app.json`, which Expo applies only from there. The Nx page says the same.
