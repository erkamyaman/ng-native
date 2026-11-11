import { provideNativeRouter } from '@ng-native/router';
import { provideWebCompat } from '@ng-native/web-compat';
import { provideTaiga } from '@taiga-ui/core/utils/miscellaneous';
import { routes } from './app.routes.ts';

export const appConfig = {
  providers: [
    // Taiga UI reaches for the DOM on what it renders: web-compat gives the engine's nodes those
    // members, so its components render as native views.
    provideWebCompat(),
    provideTaiga(),
    provideNativeRouter(routes),
  ],
};
