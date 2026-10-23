/**
 * The tab bar a page is in, for a screen that hides it while it is in front: a detail page pushed
 * in a tab's own stack, as UIKit's `hidesBottomBarWhenPushed` and SwiftUI's
 * `.toolbar(.hidden, for: .tabBar)` hide it.
 *
 * react-native-screens has no such prop on a screen, only `tabBarHidden` on the tabs host, so the
 * outlet hides the whole bar while any screen asking it to is in front. The ask says that itself,
 * through `SCREEN_IN_FRONT`, so a push, a pop, a tab switch and a page going away all reach it.
 */
import { InjectionToken, type Signal } from '@angular/core';

export interface TabBarHiding {
  /** Hide the bar while `hidden` is true. Answers what withdraws the ask. */
  hideWhile(hidden: Signal<boolean>): () => void;
}

export const TAB_BAR_HIDING = new InjectionToken<TabBarHiding>('ng-native.router.tab-bar-hiding');
