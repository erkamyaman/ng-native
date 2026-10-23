---
__default__: patch
---

`<native-header>` takes `tabBarHidden`, which hides the tab bar while that screen is in front, for a detail page pushed in a tab's own stack, on iOS and Android.

The bar comes back once the screen is popped, covered by another screen in its stack, or behind another tab, and it follows a push, a back, a swipe back, a tab switch, a link, a launch on the page and a reset. react-native-screens has no per-screen prop for it, so the outlet sets the tabs host's `tabBarHidden`, and the bar is hidden and shown without an animation rather than sliding with the push: with `setTabBarHidden:animated:NO` on iOS 18 and later, the tab bar's `hidden` on earlier iOS, and the bottom navigation bar's visibility on Android. `[barHidden]` on `<native-tabs-outlet>` still hides the bar for every tab.
