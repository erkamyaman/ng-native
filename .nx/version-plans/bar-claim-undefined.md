---
__default__: patch
---

A `StatusBar` or `NavigationBar` claim with a property set to `undefined` leaves whatever the claim underneath said for that property, as a claim that leaves the property out does.

Before, `bar.push({ style: maybeStyle, hidden: true })` with `maybeStyle` undefined put the bar back to the platform's own style while the claim lasted, and `navigationBar.push({ hidden: undefined })` showed a bar the claim underneath hid. `state()` no longer holds a property set to `undefined`, and `forScreens()`, which the router hands each screen on Android, carries the value underneath.
