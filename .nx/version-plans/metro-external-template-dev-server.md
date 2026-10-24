---
__default__: patch
---

A running Metro dev server compiles a component again once its `templateUrl` or `styleUrl` file changes or is deleted, so a reload, a relaunch or a hot update gets the component as the file is now rather than as it was compiled before.

Metro transforms again only the file that changed, and kept the component's own module, with the old template or sheet compiled into it, until the component's `.ts` file changed or Metro restarted; a touch that left the `.ts` file's text as it was did not help. `withAngularNative` now wraps `server.enhanceMiddleware` to reach the dev server, which checks the templates and stylesheets each module was compiled from before it answers a bundle request or sends a hot update. A hot update after such an edit carries the component's module as well as the template's or stylesheet's, and swaps it in place.
