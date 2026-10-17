---
__default__: minor
---

`@ng-native/expo/calendar` reads and writes the device's own calendars through `expo-calendar`'s object API: `inject(Calendar)` lists the calendars and the events in a range, finds a calendar, event or reminder by id, creates a calendar, and holds full, write-only (iOS 17) and reminders permissions as signals. What only iOS has, the default calendar, the picker, the sources and the reminders, answers empty on Android instead of throwing. `EntityTypes`, `Frequency` and `Availability` come with it, usable without loading the module.
