---
__default__: patch
---

A page that `present()` shows over another tab gets the same instances of the providers of the routes it sat inside that their `canActivate` and `canActivateChild` guards and its resolvers get, as it does in its own tab.

Before, the page's copy at the root's presented outlet had every one of those providers on one route, and the guards ran in injectors of their own, so a service a guard wrote was not the one the page read; and a page already shown in its tab was given the tab's instances. The copy is now a route for each one the page sat inside, with its own providers, guards, resolvers and data, and Angular makes one injector for each. The page gets the same url, params, data and title as before. Its `ActivatedRoute.parent` and `pathFromRoot` now include an empty-path route for each route it sat inside. With `withAutoCleanupInjectors()`, the injectors are destroyed when the page is dismissed and made again the next time it is presented.
