---
'__default__': patch
---

An app below Metro's config root starts its transform cache afresh when its own `@angular/core`, `react-native-worklets` or `react-native-reanimated` is upgraded, installed or removed.

`withAngularNative(config, { projectRoot })` read those versions for Metro's cache key from the config root, whose walk up never looks in the app's own `node_modules`. The app's copies are the ones its files resolve, so a change to them left every cached transform in place until a `--clear`. The key reads them from the app now, as it already did for `@ng-icons` sets, and keeps the config root's worklets packages beside them, since `babel-preset-expo` looks there first.
