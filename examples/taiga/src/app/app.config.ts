import { provideNativeRouter } from '@ng-native/router';
import { provideWebCompat } from '@ng-native/web-compat';
import { provideEventPlugins } from '@ng-native/web-compat/event-plugins';
import { tuiIconsProvider } from '@taiga-ui/core/tokens';
import { provideTaiga } from '@taiga-ui/core/utils/miscellaneous';
import { TAIGA_ICONS } from '../theme/taiga-icons.ts';
import { routes } from './app.routes.ts';

export const appConfig = {
  providers: [
    // Taiga UI reaches for the DOM on what it renders: web-compat gives the engine's nodes those
    // members, so its components render as native views.
    provideWebCompat(),
    // Taiga listens by names its event plugins read, such as its tabs' `tui-tab-activate.stop`.
    provideEventPlugins(),
    provideTaiga(),
    // Taiga's icons as data URLs of their markup, which web-compat draws as Taiga's masks of them:
    // a device has no server for Taiga to fetch `assets/taiga-ui/icons/*.svg` from.
    tuiIconsProvider(TAIGA_ICONS),
    provideNativeRouter(routes),
  ],
};
