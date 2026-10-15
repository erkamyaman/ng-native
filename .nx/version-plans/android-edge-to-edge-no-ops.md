---
'__default__': patch
---

`StatusBar`'s `backgroundColor` and `translucent`, and the `statusBarColor`, `statusBarTranslucent`, `navigationBarColor` and `navigationBarTranslucent` screen presentation options, are deprecated: they do nothing under Android edge-to-edge, which is always on with Expo SDK 57. They still compile. On iOS `StatusBar` no longer sends `backgroundColor` or `translucent`, so React Native's "only available on Android" warning is gone, and on Android it warns once in development when one is set. `<modal>` no longer warns that `navigationBarTranslucent` needs `statusBarTranslucent`, since React Native turns both on under edge-to-edge.
