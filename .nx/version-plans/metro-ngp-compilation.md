---
__default__: minor
---

`withAngularNative` takes an experimental `compilation: 'ngp'`, which compiles components with Angular's hybrid compiler (a Rust analysis pass in front of Angular's own template compiler) in place of oxc, as Analog's `compilation: 'ngp'` does.

It needs Angular 22.2 or later. `@ng-native/metro` ships a build of `@angular/ngp` until Angular publishes it, and an app's own copy wins. Templates and the app's TypeScript are type-checked with TypeScript 7's language server as they compile, which needs `@typescript/native-preview`; `disableTypeChecking: true` turns it off, and `tsconfig` names the file to analyze. The default stays `'oxc'`, and nothing changes for an app that does not opt in.
