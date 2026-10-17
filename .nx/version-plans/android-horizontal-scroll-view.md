---
__default__: patch
---

On Android, a horizontal `<scroll-view>` or `<virtual-list>` commits as React Native's `AndroidHorizontalScrollView`, with its content in an `AndroidHorizontalScrollContentView`, and is made again when `horizontal` changes, so one turned horizontal after it mounted scrolls sideways.

Android chooses between its vertical and horizontal scroll view once, when the view is created, and the vertical one ignores `horizontal`. A scroll view whose `horizontal` changed was cloned, so it kept the axis it was created with. It is now created again, as React Native remounts it, which starts its scroll position and the native state of everything in it over. The same holds for an element of an app's own registered as `ScrollView`, and for a scroll view inside a `<refresh-control>`'s swipe layout. `viewNameOf` answers `AndroidHorizontalScrollView` for such an element on Android. iOS is unchanged: one scroll view, which takes `horizontal` as a prop.
