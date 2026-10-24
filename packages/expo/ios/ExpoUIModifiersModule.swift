import ExpoModulesCore
#if canImport(ExpoUI)
import ExpoUI
#endif

/**
 The SwiftUI modifiers `@ng-native/expo` adds to `@expo/ui`'s, registered as it loads. A build
 without `@expo/ui` has no modifiers to add to, and this does nothing.
 */
public final class ExpoUIModifiersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NgNativeExpoUIModifiers")

    OnCreate {
      #if canImport(ExpoUI)
      _ = Self.registered
      #endif
    }
  }

  #if canImport(ExpoUI)
  /**
   Registers the modifiers once per process, as `expo-widgets` registers its own. `@expo/ui`'s
   registry is one dictionary for the whole process, outlives a reload, and has no lock: Expo creates
   this module again on every reload, on the JavaScript thread, while the main thread can still be
   drawing the outgoing screens' SwiftUI views and reading that dictionary. Writing it again then
   is a data race, and these factories capture nothing, so there is nothing to replace. A static's
   initializer runs once, behind a lock, and the first one runs before any SwiftUI view is drawn.
   */
  private static let registered: Void = {
    ViewModifierRegistry.register("ngNativeInlineNavigationTitle") { _, _, _ in
      InlineNavigationTitle()
    }
    ViewModifierRegistry.register("ngNativeSegmentedFont") { params, _, _ in
      SegmentedFont(params: params)
    }
  }()
  #endif
}
