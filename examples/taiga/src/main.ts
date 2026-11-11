import 'expo';
import { AppRegistry, Platform, processColor } from 'react-native';
import { mount } from '@ng-native/platform';
import { getFabricUIManager, registerPlatformComponents } from '@ng-native/fabric';
import { provideWebCompat } from '@ng-native/web-compat';
import { provideTaiga } from '@taiga-ui/core';
import { App } from './app/app.ts';
import { installDomAdapter } from './app/dom-adapter.ts';
import { provideEventPluginsBridge } from './app/event-plugins-bridge.ts';

registerPlatformComponents(Platform.OS);
installDomAdapter();

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mount(Number(rootTag), App, getFabricUIManager(), {
    processColor,
    providers: [provideEventPluginsBridge(), provideWebCompat(), provideTaiga()],
  });
});
