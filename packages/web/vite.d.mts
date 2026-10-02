import type { PluginOptions } from '@oxc-angular/vite';
import type { Plugin } from 'vite';

/**
 * The Vite preset for a browser app on `@ng-native/web`: compiles the app's components, links the
 * `@ng-native/*` packages, and keeps React Native and Expo out of the build.
 *
 * `options` go to `@oxc-angular/vite`'s `angular()`, over `zoneless: true` and
 * `emitClassMetadata: false`.
 */
export declare function ngNativeWeb(options?: PluginOptions): Plugin[];

/**
 * `ngNativeWeb()` without the compiler, for an app whose own Angular plugin compiles its
 * components, as Analog's does: the resolution, and `@oxc-angular/vite`'s linker for the
 * `@ng-native/*` packages.
 */
export declare function ngNativeWebLink(): Plugin[];
