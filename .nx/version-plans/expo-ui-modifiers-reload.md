---
__default__: patch
---

On iOS, `@ng-native/expo` registers its `@expo/ui` modifiers once per app launch instead of on every reload, which could crash a development build in `ViewModifierRegistry.register` during a hot reload.

`@expo/ui`'s modifier registry is shared by the whole process and has no lock, and Expo recreates modules on the JavaScript thread on each reload while the main thread can still be reading the registry for SwiftUI views on screen. The modifiers are the same on every reload, so they are now registered the first time the module is created.
