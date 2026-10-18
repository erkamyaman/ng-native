---
__default__: patch
---

Content projected into an `@if` or another control-flow block of a component keeps its event listeners, and an element that hoists keeps hoisting, when the block closes and opens again.

When such a block closes, Angular destroys the nodes an `<ng-content>` at its top projects, though they belong to the component that declared them, and when it opens it puts the same nodes back without listening to them again. The engine dropped their listeners there, so a projected `(layout)` handler or a `<pressable>`'s hover stopped firing, and it stopped hoisting an element such as `<native-header>` or `<native-toolbar>` into its screen. Listeners now go when the view or directive that added them tears them down.
