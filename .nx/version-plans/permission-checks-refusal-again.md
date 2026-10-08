---
'__default__': patch
---

`Permission.ensure()` checks a refused permission again before answering, so one the person turns on in Settings works on the next call, without a dialog.

It used to ask the platform only once, so after a refusal for good it answered no, and `blocked()` stayed true, until the app restarted, which neither platform does when a permission is turned on. This reached `Location`, `Notifications`, `ImagePicker`, `MediaLibrary`, `ScreenCapture` and `Tracking`. A `Permission` built in an injection context also checks a no again when the app comes back to the front, so a screen that shows `blocked()` changes by itself. A granted answer is still kept, and the dialog still shows only when the platform will show one.
