---
__default__: patch
---

`styleSheetOf()` returns a component's compiled sheet when it is called at the top level of the module that declares the component, as in `export const themeStyles = styleSheetOf(ThemeStyles)`, where it returned `null`.

The Metro transform assigned each component's sheet at the end of its module, after the module's own top-level code had run. It now hands the sheet to the class as Angular defines the component, in development and release builds, so a library the app's Metro compiles can export its global sheet for an app to pass to `mount()` and `loadFonts()`.
