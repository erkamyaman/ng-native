import {
  Component,
  DestroyRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { Direction } from '@ng-native/device';
import { HostEngine } from '@ng-native/fabric';
import { optionalBoolean } from './transforms.ts';
import { View } from './view.ts';
import { ViewBase } from './view-base.ts';

export type ModalPresentationStyle = 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
export type ModalOrientation =
  'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right';

/**
 * Content presented over everything else. Commits as `ModalHostView`.
 *
 * RN's `Modal.js` gives the native host `{position: 'absolute'}` (the engine's default for it)
 * and puts the children inside a full-bleed view carrying the backdrop colour. Without the
 * container the content has no backdrop and no layout box, so a modal renders as nothing.
 *
 * Events are element events: `(requestClose)` for the Android back button and an iOS swipe,
 * `(show)`, `(dismiss)`, and `(orientationChange)`.
 *
 * The container is pinned to the leading edge with `[side]: 0`, the same as RN's own Modal.js -
 * `left` in a left-to-right layout, `right` in a right-to-left one - so the backdrop starts from
 * the edge content actually begins at rather than always the physical left.
 */
@Component({
  selector: 'modal',
  imports: [View],
  template: `<view [style]="containerStyle()" collapsable="false"><ng-content /></view>`,
  host: {
    '[visible]': 'visible()',
    '[transparent]': 'transparent()',
    '[animationType]': 'animationType()',
    '[presentationStyle]': 'resolvedPresentationStyle()',
    '[supportedOrientations]': 'supportedOrientations()',
    '[allowSwipeDismissal]': 'allowSwipeDismissal()',
    '[statusBarTranslucent]': 'statusBarTranslucent()',
    '[navigationBarTranslucent]': 'navigationBarTranslucent()',
    '[hardwareAccelerated]': 'hardwareAccelerated()',
  },
})
export class Modal extends ViewBase {
  /**
   * Whether the modal is showing. Defaults to true, as in RN. While false the engine leaves the
   * native host out of the commit, as RN's Modal returns null when hidden, because the host
   * covers the screen and takes every touch whether or not it presents; on iOS a modal that was
   * showing stays until native reports its dismissal.
   */
  readonly visible = input(true, { transform: booleanAttribute });
  /** See through to the screen behind; the container gets no backdrop. */
  readonly transparent = input(false, { transform: booleanAttribute });
  /** The container's background when not transparent. Defaults to white. */
  readonly backdropColor = input<string>();
  /** How the modal appears and leaves. Defaults to `none`. */
  readonly animationType = input<'none' | 'slide' | 'fade'>();
  /** iOS: full screen, a sheet, or over the current content. `overFullScreen` if transparent. */
  readonly presentationStyle = input<ModalPresentationStyle>();
  /** iOS: which orientations the modal may rotate to. Defaults to portrait. */
  readonly supportedOrientations = input<readonly ModalOrientation[]>();
  /** iOS: let a downward swipe dismiss the modal, reported through `(requestClose)`. */
  readonly allowSwipeDismissal = input(undefined, { transform: optionalBoolean });
  /**
   * Android: draw under the status bar. Always on under Android edge-to-edge (Expo SDK 57), where
   * React Native ignores `false`.
   */
  readonly statusBarTranslucent = input(undefined, { transform: optionalBoolean });
  /**
   * Android: draw under the navigation bar. Always on under Android edge-to-edge (Expo SDK 57),
   * where React Native ignores `false`. In an app that opts out, it needs `statusBarTranslucent`.
   */
  readonly navigationBarTranslucent = input(undefined, { transform: optionalBoolean });
  /** Android: give the modal's window a hardware-accelerated surface. */
  readonly hardwareAccelerated = input(undefined, { transform: optionalBoolean });

  private readonly direction = inject(Direction);

  protected readonly resolvedPresentationStyle = computed(
    () => this.presentationStyle() ?? (this.transparent() ? 'overFullScreen' : undefined),
  );

  protected readonly containerStyle = computed(() => ({
    [this.direction.rtl() ? 'right' : 'left']: 0,
    top: 0,
    flex: 1,
    backgroundColor: this.transparent() ? 'transparent' : (this.backdropColor() ?? 'white'),
  }));

  constructor() {
    super();
    // RN's host claims any touch that reaches it, so nothing inside the modal can hand a
    // gesture to the screen underneath.
    const stop = inject(HostEngine).setResponder(this.node, {
      onStartShouldSetResponder: () => true,
    });
    inject(DestroyRef).onDestroy(stop);

    effect(() => {
      const style = this.presentationStyle();
      if (this.transparent() && style && style !== 'overFullScreen') {
        console.warn(
          `[angular-native] <modal> is transparent, which needs presentationStyle="overFullScreen" on iOS; '${style}' will not be see-through.`,
        );
      }
    });
  }
}
