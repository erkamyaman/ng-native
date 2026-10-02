---
__default__: minor
---

`@ng-native/web/vite` exports `ngNativeWebLink()`: `ngNativeWeb()` without the compiler, for an app whose own Angular plugin compiles its components, such as Analog. It keeps the browser resolution and `@oxc-angular/vite`'s linker, which links the `@ng-native/*` packages from `dist/`.
