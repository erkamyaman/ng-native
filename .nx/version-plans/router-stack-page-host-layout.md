---
__default__: patch
---

On iOS 26 and later, a stack page's `:host` layout (`flex-direction`, `justify-content`, `align-items`, `gap`) lays out the elements at the root of its template again, and a `:host > ...` selector matches them again.

The safe area view the stack outlet puts a page's content in on iOS 26 and later, which starts it below an opaque `<native-header>`, is now made by the engine as a view of the screen's own (`Engine.wrapChildren`) rather than as an element of the page's tree. The page's template stays in its host, the screen, so its `:host` rules and selectors reach it as written, and the layout `:host` gives its children is committed on the safe area view, which holds them. For a page whose `:host` gives no such layout, the native views and their props are the ones committed before, and the header is still a child of the screen either way. Before iOS 26 and on Android nothing changes.
