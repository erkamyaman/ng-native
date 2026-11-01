---
__default__: patch
---

In `@ng-native/router`, a page of another tab shown with `present()` keeps the `title`, `canDeactivate`, `runGuardsAndResolvers` and `resources` of the routes above it, as in its tab, and `present()` shows a page behind a `canLoad` guard where its url puts it.

Before, the presented copy of each route above the page kept only its providers, `canActivate`, `canActivateChild`, `resolve` and `data`. A title set above a page with none of its own was missing from the presented page's route, a `canDeactivate` guard above the page did not run when it was dismissed, and resolvers above it ran again on the default `paramsChange` whatever the route said. Such a guard now runs as the presented page is dismissed, with `null` for the component, since the copy of a route above the page has none.

A route above the page with a `canLoad` guard had its children loaded without running the guard, and the page presented. The page is now shown where its url puts it, where the router runs the guard.
